import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    RegionDataAccessor,
    RegionLabel,
    Polygon as DMPolygon,
    RegionLabelDataAccessor,
    Vertex,
    RegionOperationLogDataAccessor,
    RegionOperationLogLabelMetadataDataAccessor,
    RegionOperationLogDrawMetadataDataAccessor,
    REGION_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
    REGION_LABEL_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_DRAW_METADATA_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_LABEL_METADATA_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { Polygon } from "../../proto/gen/Polygon";
import { Region } from "../../proto/gen/Region";
import { RegionOperationLog } from "../../proto/gen/RegionOperationLog";
import { _RegionOperationType_Values } from "../../proto/gen/RegionOperationType";
import {
    BinaryConverter,
    BINARY_CONVERTER_TOKEN,
    convertProtoDoubleToNumber,
    ErrorWithStatus,
    LOGGER_TOKEN,
    Timer,
    TIMER_TOKEN,
} from "../../utils";
import {
    RegionNormalizer,
    REGION_NORMALIZER_TOKEN,
} from "./polygon_normalizer";

export interface RegionManagementOperator {
    createRegion(
        ofImageID: number,
        drawnByUserID: number,
        labeledByUserId: number,
        border: Polygon,
        holes: Polygon[],
        labelID: number | undefined
    ): Promise<Region>;
    getRegionOperationLogList(
        ofImageID: number,
        regionID: number
    ): Promise<RegionOperationLog[]>;
    updateRegionBoundary(
        ofImageID: number,
        regionID: number,
        drawnByUserID: number,
        border: Polygon,
        holes: Polygon[]
    ): Promise<Region>;
    updateRegionLabel(
        ofImageID: number,
        regionID: number,
        labeledByUserID: number,
        labelID: number
    ): Promise<Region>;
    deleteRegion(ofImageID: number, regionID: number): Promise<void>;
}

export class RegionManagementOperatorImpl implements RegionManagementOperator {
    constructor(
        private readonly regionDM: RegionDataAccessor,
        private readonly imageDM: ImageDataAccessor,
        private readonly regionLabelDM: RegionLabelDataAccessor,
        private readonly regionOperationLogDM: RegionOperationLogDataAccessor,
        private readonly regionOperationLogDrawMetadataDM: RegionOperationLogDrawMetadataDataAccessor,
        private readonly regionOperationLogLabelMetadataDM: RegionOperationLogLabelMetadataDataAccessor,
        private readonly regionNormalizer: RegionNormalizer,
        private readonly timer: Timer,
        private readonly binaryConverter: BinaryConverter,
        private readonly logger: Logger
    ) {}

    public async createRegion(
        ofImageID: number,
        drawnByUserID: number,
        labeledByUserID: number,
        border: Polygon,
        holes: Polygon[],
        labelID: number | undefined
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageID);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageID: ofImageID,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageID} not found`,
                status.NOT_FOUND
            );
        }

        const regionLabel: RegionLabel | null =
            await this.getOptionalRegionLabel(labelID);
        if (regionLabel && image.imageType?.id !== regionLabel.ofImageTypeID) {
            this.logger.error(
                "region label with label_id is not allowed for the image type of image with image_id",
                { labelID, imageID: ofImageID }
            );
            throw new ErrorWithStatus(
                `region label with label_id ${labelID} is not allowed for the image type of image with image_id ${ofImageID}`,
                status.FAILED_PRECONDITION
            );
        }

        const normalizedBorderAndHoles = this.regionNormalizer.normalizeRegion(
            border,
            holes
        );
        border = normalizedBorderAndHoles.border;
        holes = normalizedBorderAndHoles.holes;

        const dmBorder = this.getDMPolygonFromPolygon(border);
        const dmHoles = holes.map((hole) => this.getDMPolygonFromPolygon(hole));

        return this.regionDM.withTransaction(async (regionDM) => {
            const createdRegionID = await regionDM.createRegion({
                ofImageID,
                drawnByUserID,
                labeledByUserID,
                border: dmBorder,
                holes: dmHoles,
                labelID: labelID === undefined ? null : labelID,
            });

            return this.regionOperationLogDM.withTransaction(
                async (regionOperationLogDM) => {
                    return this.regionOperationLogDrawMetadataDM.withTransaction(
                        async (regionOperationLogDrawMetadataDM) => {
                            return this.regionOperationLogLabelMetadataDM.withTransaction(
                                async (regionOperationLogLabelMetadataDM) => {
                                    const drawLogID =
                                        await regionOperationLogDM.createRegionOperationLog(
                                            {
                                                ofRegionID: createdRegionID,
                                                byUserID: drawnByUserID,
                                                operationTime: currentTime,
                                                operationType:
                                                    _RegionOperationType_Values.DRAW,
                                            }
                                        );
                                    await regionOperationLogDrawMetadataDM.createRegionOperationLogDrawMetadata(
                                        {
                                            ofLogID: drawLogID,
                                            oldBorder: null,
                                            oldHoles: null,
                                            newBorder: dmBorder,
                                            newHoles: dmHoles,
                                        }
                                    );

                                    const labelLogID =
                                        await regionOperationLogDM.createRegionOperationLog(
                                            {
                                                ofRegionID: createdRegionID,
                                                byUserID: labeledByUserID,
                                                operationTime: currentTime,
                                                operationType:
                                                    _RegionOperationType_Values.LABEL,
                                            }
                                        );
                                    await regionOperationLogLabelMetadataDM.createRegionOperationLogLabelMetadata(
                                        {
                                            ofLogID: labelLogID,
                                            oldLabelID: null,
                                            newLabelID:
                                                labelID === undefined
                                                    ? null
                                                    : labelID,
                                        }
                                    );

                                    return {
                                        id: createdRegionID,
                                        drawnByUserId: drawnByUserID,
                                        labeledByUserId: labeledByUserID,
                                        border: border,
                                        holes: holes,
                                        label: regionLabel,
                                    };
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    private async getOptionalRegionLabel(
        labelID: number | undefined
    ): Promise<RegionLabel | null> {
        if (labelID === undefined) {
            return null;
        }
        const regionLabel = await this.regionLabelDM.getRegionLabel(labelID);
        if (regionLabel === null) {
            this.logger.error("region label with label_id not found", {
                labelID,
            });
            throw new ErrorWithStatus(
                `region label with label_id ${labelID} not found`,
                status.NOT_FOUND
            );
        }
        return regionLabel;
    }

    private getDMPolygonFromPolygon(polygon: Polygon): DMPolygon {
        if (polygon.vertices === undefined) {
            this.logger.error("polygon without vertices");
            throw new ErrorWithStatus(
                "polygon without vertices",
                status.INVALID_ARGUMENT
            );
        }
        const dmVertices = polygon.vertices.map(
            (vertex) =>
                new Vertex(
                    convertProtoDoubleToNumber(vertex.x),
                    convertProtoDoubleToNumber(vertex.y)
                )
        );
        return new DMPolygon(dmVertices);
    }

    public async getRegionOperationLogList(
        ofImageID: number,
        regionID: number
    ): Promise<RegionOperationLog[]> {
        const image = await this.imageDM.getImage(ofImageID);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageID: ofImageID,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageID} not found`,
                status.NOT_FOUND
            );
        }

        const region = await this.regionDM.getRegion(regionID);
        if (region === null) {
            this.logger.error("region with region_id not found", {
                regionID,
            });
            throw new ErrorWithStatus(
                `region with region_id ${regionID} not found`,
                status.NOT_FOUND
            );
        }

        if (region.ofImageID !== ofImageID) {
            this.logger.error(
                "region with region_id not found in image with image_id",
                {
                    imageID: ofImageID,
                    regionID,
                }
            );
            throw new ErrorWithStatus(
                `region with region_id ${regionID} not found in image with image_id ${ofImageID}`,
                status.NOT_FOUND
            );
        }

        const regionOperationLogList =
            await this.regionOperationLogDM.getRegionOperationLogListOfRegion(
                regionID
            );

        const resultList: RegionOperationLog[] = [];
        for (const log of regionOperationLogList) {
            if (log.operationType === _RegionOperationType_Values.DRAW) {
                const drawMetadata =
                    await this.regionOperationLogDrawMetadataDM.getRegionOperationLogDrawMetadataOfLog(
                        log.id
                    );
                if (drawMetadata === null) {
                    throw new ErrorWithStatus(
                        `log with log_id ${log.id} does not have draw metadata`,
                        status.INTERNAL
                    );
                }

                resultList.push({
                    id: log.id,
                    byUserId: log.byUserID,
                    operationTime: log.operationTime,
                    operationType: log.operationType,
                    drawMetadata: {
                        oldBorder:
                            drawMetadata.oldBorder === null
                                ? undefined
                                : drawMetadata.oldBorder,
                        oldHoles:
                            drawMetadata.oldHoles === null
                                ? undefined
                                : drawMetadata.newHoles,
                        newBorder:
                            drawMetadata.newBorder === null
                                ? undefined
                                : drawMetadata.newBorder,
                        newHoles:
                            drawMetadata.oldBorder === null
                                ? undefined
                                : drawMetadata.newHoles,
                    },
                });
            } else {
                const labelMetadata =
                    await this.regionOperationLogLabelMetadataDM.getRegionOperationLogLabelMetadataOfLog(
                        log.id
                    );
                if (labelMetadata === null) {
                    throw new ErrorWithStatus(
                        `log with log_id ${log.id} does not have label metadata`,
                        status.INTERNAL
                    );
                }

                resultList.push({
                    id: log.id,
                    byUserId: log.byUserID,
                    operationTime: log.operationTime,
                    operationType: log.operationType,
                    labelMetadata: labelMetadata,
                });
            }
        }

        return resultList;
    }

    public async updateRegionBoundary(
        ofImageID: number,
        regionID: number,
        drawnByUserID: number,
        border: Polygon,
        holes: Polygon[]
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageID);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageID: ofImageID,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageID} not found`,
                status.NOT_FOUND
            );
        }

        const normalizedBorderAndHoles = this.regionNormalizer.normalizeRegion(
            border,
            holes
        );
        border = normalizedBorderAndHoles.border;
        holes = normalizedBorderAndHoles.holes;

        const dmBorder = this.getDMPolygonFromPolygon(border);
        const dmHoles = holes.map((hole) => this.getDMPolygonFromPolygon(hole));

        return this.regionDM.withTransaction(async (regionDM) => {
            const region = await this.regionDM.getRegionWithXLock(regionID);
            if (region === null) {
                this.logger.error("no region with region_id found", {
                    regionID,
                });
                throw new ErrorWithStatus(
                    `no region with region_id ${regionID} found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageID !== ofImageID) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageID: ofImageID,
                        regionID,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionID} not found in image with image_id ${ofImageID}`,
                    status.NOT_FOUND
                );
            }

            const oldBorder = region.border;
            const oldHoles = region.holes;
            region.border = dmBorder;
            region.holes = dmHoles;

            await regionDM.updateRegion({
                id: region.id,
                drawnByUserID: drawnByUserID,
                labeledByUserID: region.labeledByUserID,
                border: dmBorder,
                holes: dmHoles,
                labelID: region.label === null ? null : region.label.id,
            });

            return this.regionOperationLogDM.withTransaction(
                async (regionOperationLogDM) => {
                    return this.regionOperationLogDrawMetadataDM.withTransaction(
                        async (regionOperationLogDrawMetadataDM) => {
                            const drawLogID =
                                await regionOperationLogDM.createRegionOperationLog(
                                    {
                                        ofRegionID: regionID,
                                        byUserID: drawnByUserID,
                                        operationTime: currentTime,
                                        operationType:
                                            _RegionOperationType_Values.DRAW,
                                    }
                                );
                            await regionOperationLogDrawMetadataDM.createRegionOperationLogDrawMetadata(
                                {
                                    ofLogID: drawLogID,
                                    oldBorder: oldBorder,
                                    oldHoles: oldHoles,
                                    newBorder: dmBorder,
                                    newHoles: dmHoles,
                                }
                            );

                            return {
                                id: regionID,
                                drawnByUserId: drawnByUserID,
                                labeledByUserId: region.labeledByUserID,
                                border: border,
                                holes: holes,
                                label: region.label,
                            };
                        }
                    );
                }
            );
        });
    }

    public async updateRegionLabel(
        ofImageID: number,
        regionID: number,
        labeledByUserID: number,
        labelID: number
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageID);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageID: ofImageID,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageID} not found`,
                status.NOT_FOUND
            );
        }

        const newLabel = await this.regionLabelDM.getRegionLabel(labelID);
        if (newLabel === null) {
            this.logger.error("region label with label_id not found", {
                labelID,
            });
            throw new ErrorWithStatus(
                `region label with label_id ${labelID} not found`,
                status.NOT_FOUND
            );
        }

        if (newLabel.ofImageTypeID !== image.imageType?.id) {
            this.logger.error(
                "region label with label_id is not allowed for the image type of image with image_id",
                { labelID, imageID: ofImageID }
            );
            throw new ErrorWithStatus(
                `region label with label_id ${labelID} is not allowed for the image type of image with image_id ${ofImageID}`,
                status.FAILED_PRECONDITION
            );
        }

        return this.regionDM.withTransaction(async (regionDM) => {
            const region = await this.regionDM.getRegionWithXLock(regionID);
            if (region === null) {
                this.logger.error("no region with region_id found", {
                    regionID,
                });
                throw new ErrorWithStatus(
                    `no region with region_id ${regionID} found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageID !== ofImageID) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageID: ofImageID,
                        regionID,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionID} not found in image with image_id ${ofImageID}`,
                    status.NOT_FOUND
                );
            }

            const oldLabel = region.label;
            region.label = newLabel;

            await regionDM.updateRegion({
                id: region.id,
                drawnByUserID: region.drawnByUserID,
                labeledByUserID: labeledByUserID,
                border: region.border,
                holes: region.holes,
                labelID: labelID,
            });

            return this.regionOperationLogDM.withTransaction(
                async (regionOperationLogDM) => {
                    return this.regionOperationLogLabelMetadataDM.withTransaction(
                        async (regionOperationLogLabelMetadataDM) => {
                            const drawLogID =
                                await regionOperationLogDM.createRegionOperationLog(
                                    {
                                        ofRegionID: regionID,
                                        byUserID: labeledByUserID,
                                        operationTime: currentTime,
                                        operationType:
                                            _RegionOperationType_Values.LABEL,
                                    }
                                );
                            await regionOperationLogLabelMetadataDM.createRegionOperationLogLabelMetadata(
                                {
                                    ofLogID: drawLogID,
                                    oldLabelID:
                                        oldLabel === null ? null : oldLabel.id,
                                    newLabelID: newLabel.id,
                                }
                            );

                            return {
                                id: regionID,
                                drawnByUserId: region.drawnByUserID,
                                labeledByUserId: labeledByUserID,
                                border: region.border,
                                holes: region.holes,
                                label: newLabel,
                            };
                        }
                    );
                }
            );
        });
    }

    public async deleteRegion(
        ofImageID: number,
        regionID: number
    ): Promise<void> {
        const image = await this.imageDM.getImage(ofImageID);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageID: ofImageID,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageID} not found`,
                status.NOT_FOUND
            );
        }
        return this.regionDM.withTransaction(async (regionDM) => {
            const region = await regionDM.getRegionWithXLock(regionID);
            if (region === null) {
                this.logger.error("region with region_id not found", {
                    regionID,
                });
                throw new ErrorWithStatus(
                    `region with region_id ${regionID} not found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageID !== ofImageID) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageID: ofImageID,
                        regionID,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionID} not found in image with image_id ${ofImageID}`,
                    status.NOT_FOUND
                );
            }

            await regionDM.deleteRegion(regionID);
        });
    }
}

injected(
    RegionManagementOperatorImpl,
    REGION_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
    REGION_LABEL_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_DRAW_METADATA_DATA_ACCESSOR_TOKEN,
    REGION_OPERATION_LOG_LABEL_METADATA_DATA_ACCESSOR_TOKEN,
    REGION_NORMALIZER_TOKEN,
    TIMER_TOKEN,
    BINARY_CONVERTER_TOKEN,
    LOGGER_TOKEN
);

export const REGION_MANAGEMENT_OPERATOR_TOKEN = token<RegionManagementOperator>(
    "RegionManagementOperator"
);
