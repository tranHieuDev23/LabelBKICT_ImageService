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
        ofImageId: number,
        drawnByUserId: number,
        labeledByUserId: number,
        border: Polygon,
        holes: Polygon[],
        labeId: number | undefined
    ): Promise<Region>;
    getRegionOperationLogList(
        ofImageId: number,
        regionId: number
    ): Promise<RegionOperationLog[]>;
    updateRegionBoundary(
        ofImageId: number,
        regionId: number,
        drawnByUserId: number,
        border: Polygon,
        holes: Polygon[]
    ): Promise<Region>;
    updateRegionLabel(
        ofImageId: number,
        regionId: number,
        labeledByUserId: number,
        labeId: number
    ): Promise<Region>;
    deleteRegion(ofImageId: number, regionId: number): Promise<void>;
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
        private readonly logger: Logger
    ) {}

    public async createRegion(
        ofImageId: number,
        drawnByUserId: number,
        labeledByUserId: number,
        border: Polygon,
        holes: Polygon[],
        labeId: number | undefined
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
                status.NOT_FOUND
            );
        }

        const regionLabel: RegionLabel | null =
            await this.getOptionalRegionLabel(labeId);
        if (regionLabel && image.imageType?.id !== regionLabel.ofImageTypeId) {
            this.logger.error(
                "region label with label_id is not allowed for the image type of image with image_id",
                { labeId, imageId: ofImageId }
            );
            throw new ErrorWithStatus(
                `region label with label_id ${labeId} is not allowed for the image type of image with image_id ${ofImageId}`,
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

        const createdRegionId = await this.regionDM.createRegion({
            ofImageId,
            drawnByUserId: drawnByUserId,
            labeledByUserId: labeledByUserId,
            border: dmBorder,
            holes: dmHoles,
            labeId: labeId === undefined ? null : labeId,
        });

        const drawLogId =
            await this.regionOperationLogDM.createRegionOperationLog({
                ofRegionId: createdRegionId,
                byUserId: drawnByUserId,
                operationTime: currentTime,
                operationType: _RegionOperationType_Values.DRAW,
            });
        await this.regionOperationLogDrawMetadataDM.createRegionOperationLogDrawMetadata(
            {
                ofLogId: drawLogId,
                oldBorder: null,
                oldHoles: null,
                newBorder: dmBorder,
                newHoles: dmHoles,
            }
        );

        const labelLogId =
            await this.regionOperationLogDM.createRegionOperationLog({
                ofRegionId: createdRegionId,
                byUserId: labeledByUserId,
                operationTime: currentTime,
                operationType: _RegionOperationType_Values.LABEL,
            });
        await this.regionOperationLogLabelMetadataDM.createRegionOperationLogLabelMetadata(
            {
                ofLogId: labelLogId,
                oldLabelId: null,
                newLabelId: labeId === undefined ? null : labeId,
            }
        );

        return {
            id: createdRegionId,
            drawnByUserId: drawnByUserId,
            labeledByUserId: labeledByUserId,
            border: border,
            holes: holes,
            label: regionLabel,
        };
    }

    private async getOptionalRegionLabel(
        labeId: number | undefined
    ): Promise<RegionLabel | null> {
        if (labeId === undefined) {
            return null;
        }
        const regionLabel = await this.regionLabelDM.getRegionLabel(labeId);
        if (regionLabel === null) {
            this.logger.error("region label with label_id not found", {
                labeId,
            });
            throw new ErrorWithStatus(
                `region label with label_id ${labeId} not found`,
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
        ofImageId: number,
        regionId: number
    ): Promise<RegionOperationLog[]> {
        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
                status.NOT_FOUND
            );
        }

        const region = await this.regionDM.getRegion(regionId);
        if (region === null) {
            this.logger.error("region with region_id not found", {
                regionId,
            });
            throw new ErrorWithStatus(
                `region with region_id ${regionId} not found`,
                status.NOT_FOUND
            );
        }

        if (region.ofImageId !== ofImageId) {
            this.logger.error(
                "region with region_id not found in image with image_id",
                {
                    imageId: ofImageId,
                    regionId,
                }
            );
            throw new ErrorWithStatus(
                `region with region_id ${regionId} not found in image with image_id ${ofImageId}`,
                status.NOT_FOUND
            );
        }

        const regionOperationLogList =
            await this.regionOperationLogDM.getRegionOperationLogListOfRegion(
                regionId
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
                    byUserId: log.byUserId,
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
                    byUserId: log.byUserId,
                    operationTime: log.operationTime,
                    operationType: log.operationType,
                    labelMetadata: labelMetadata,
                });
            }
        }

        return resultList;
    }

    public async updateRegionBoundary(
        ofImageId: number,
        regionId: number,
        drawnByUserId: number,
        border: Polygon,
        holes: Polygon[]
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
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
            const region = await this.regionDM.getRegionWithXLock(regionId);
            if (region === null) {
                this.logger.error("no region with region_id found", {
                    regionId,
                });
                throw new ErrorWithStatus(
                    `no region with region_id ${regionId} found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageId !== ofImageId) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageId: ofImageId,
                        regionId,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionId} not found in image with image_id ${ofImageId}`,
                    status.NOT_FOUND
                );
            }

            const oldBorder = region.border;
            const oldHoles = region.holes;
            region.border = dmBorder;
            region.holes = dmHoles;

            await regionDM.updateRegion({
                id: region.id,
                drawnByUserId: drawnByUserId,
                labeledByUserId: region.labeledByUserId,
                border: dmBorder,
                holes: dmHoles,
                labelId: region.label === null ? null : region.label.id,
            });

            const drawLogId =
                await this.regionOperationLogDM.createRegionOperationLog({
                    ofRegionId: regionId,
                    byUserId: drawnByUserId,
                    operationTime: currentTime,
                    operationType: _RegionOperationType_Values.DRAW,
                });

            await this.regionOperationLogDrawMetadataDM.createRegionOperationLogDrawMetadata(
                {
                    ofLogId: drawLogId,
                    oldBorder: oldBorder,
                    oldHoles: oldHoles,
                    newBorder: dmBorder,
                    newHoles: dmHoles,
                }
            );

            // HACK: since we can't get region label with x lock, need to manually retrieve region label here
            const regionLabel =
                region.label === null
                    ? null
                    : await this.regionLabelDM.getRegionLabel(region.label.id);

            return {
                id: regionId,
                drawnByUserId: drawnByUserId,
                labeledByUserId: region.labeledByUserId,
                border: border,
                holes: holes,
                label: regionLabel,
            };
        });
    }

    public async updateRegionLabel(
        ofImageId: number,
        regionId: number,
        labeledByUserId: number,
        labeId: number
    ): Promise<Region> {
        const currentTime = this.timer.getCurrentTime();

        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
                status.NOT_FOUND
            );
        }

        const newLabel = await this.regionLabelDM.getRegionLabel(labeId);
        if (newLabel === null) {
            this.logger.error("region label with label_id not found", {
                labeId,
            });
            throw new ErrorWithStatus(
                `region label with label_id ${labeId} not found`,
                status.NOT_FOUND
            );
        }

        if (newLabel.ofImageTypeId !== image.imageType?.id) {
            this.logger.error(
                "region label with label_id is not allowed for the image type of image with image_id",
                { labeId, imageId: ofImageId }
            );
            throw new ErrorWithStatus(
                `region label with label_id ${labeId} is not allowed for the image type of image with image_id ${ofImageId}`,
                status.FAILED_PRECONDITION
            );
        }

        return this.regionDM.withTransaction(async (regionDM) => {
            const region = await this.regionDM.getRegionWithXLock(regionId);
            if (region === null) {
                this.logger.error("no region with region_id found", {
                    regionId,
                });
                throw new ErrorWithStatus(
                    `no region with region_id ${regionId} found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageId !== ofImageId) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageId: ofImageId,
                        regionId,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionId} not found in image with image_id ${ofImageId}`,
                    status.NOT_FOUND
                );
            }

            const oldLabel = region.label;
            region.label = newLabel;

            await regionDM.updateRegion({
                id: region.id,
                drawnByUserId: region.drawnByUserId,
                labeledByUserId: labeledByUserId,
                border: region.border,
                holes: region.holes,
                labelId: labeId,
            });

            const drawLogId =
                await this.regionOperationLogDM.createRegionOperationLog({
                    ofRegionId: regionId,
                    byUserId: labeledByUserId,
                    operationTime: currentTime,
                    operationType: _RegionOperationType_Values.LABEL,
                });

            await this.regionOperationLogLabelMetadataDM.createRegionOperationLogLabelMetadata(
                {
                    ofLogId: drawLogId,
                    oldLabelId: oldLabel === null ? null : oldLabel.id,
                    newLabelId: newLabel.id,
                }
            );

            return {
                id: regionId,
                drawnByUserId: region.drawnByUserId,
                labeledByUserId: labeledByUserId,
                border: region.border,
                holes: region.holes,
                label: newLabel,
            };
        });
    }

    public async deleteRegion(
        ofImageId: number,
        regionId: number
    ): Promise<void> {
        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
                status.NOT_FOUND
            );
        }
        return this.regionDM.withTransaction(async (regionDM) => {
            const region = await regionDM.getRegionWithXLock(regionId);
            if (region === null) {
                this.logger.error("region with region_id not found", {
                    regionId,
                });
                throw new ErrorWithStatus(
                    `region with region_id ${regionId} not found`,
                    status.NOT_FOUND
                );
            }

            if (region.ofImageId !== ofImageId) {
                this.logger.error(
                    "region with region_id not found in image with image_id",
                    {
                        imageId: ofImageId,
                        regionId,
                    }
                );
                throw new ErrorWithStatus(
                    `region with region_id ${regionId} not found in image with image_id ${ofImageId}`,
                    status.NOT_FOUND
                );
            }

            await regionDM.deleteRegion(regionId);
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
    LOGGER_TOKEN
);

export const REGION_MANAGEMENT_OPERATOR_TOKEN = token<RegionManagementOperator>(
    "RegionManagementOperator"
);
