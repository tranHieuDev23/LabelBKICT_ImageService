import { status } from "@grpc/grpc-js";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    RegionDataAccessor,
    RegionLabel,
    Polygon as DMPolygon,
    RegionLabelDataAccessor,
    Vertex,
    RegionOperationLogDataAccessor,
    RegionOperationType,
    RegionOperationLogLabelMetadataDataAccessor,
    RegionOperationLogDrawMetadataDataAccessor,
} from "../../dataaccess/db";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { Polygon } from "../../proto/gen/Polygon";
import { Region } from "../../proto/gen/Region";
import { RegionOperationLog } from "../../proto/gen/RegionOperationLog";
import {
    convertProtoDoubleToNumber,
    ErrorWithStatus,
    Timer,
} from "../../utils";
import { RegionNormalizer } from "./polygon_normalizer";

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
    updateRegion(
        ofImageID: number,
        regionID: number,
        drawnByUserID: number | undefined,
        labeledByUserId: number | undefined,
        border: Polygon | undefined,
        holes: Polygon[] | undefined,
        labelID: number | undefined
    ): Promise<Region>;
    deleteRegion(ofImageID: number, regionID: number): Promise<void>;
    getRegionSnapshotListOfImage(
        ofImageID: number,
        atStatus: _ImageStatus_Values
    ): Promise<Region[]>;
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

        let regionLabel: RegionLabel | null = null;
        if (labelID !== undefined) {
            regionLabel = await this.regionLabelDM.getRegionLabel(labelID);
            if (regionLabel === null) {
                this.logger.error("region label with label_id not found", {
                    labelID,
                });
                throw new ErrorWithStatus(
                    `region label with label_id ${labelID} not found`,
                    status.NOT_FOUND
                );
            }

            if (image.imageType?.id !== regionLabel.ofImageTypeID) {
                this.logger.error(
                    "region label with label_id is not allowed for the image type of image with image_id",
                    { labelID, imageID: ofImageID }
                );
                throw new ErrorWithStatus(
                    `region label with label_id ${labelID} is not allowed for the image type of image with image_id ${ofImageID}`,
                    status.FAILED_PRECONDITION
                );
            }
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
                                                    RegionOperationType.DRAW,
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
                                                    RegionOperationType.LABEL,
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

    private getDMPolygonFromPolygon(polygon: Polygon): DMPolygon {
        if (polygon.vertices === undefined) {
            return new DMPolygon([]);
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
        throw new Error("Method not implemented.");
    }

    public async updateRegion(
        ofImageID: number,
        regionID: number,
        drawnByUserID: number | undefined,
        labeledByUserId: number | undefined,
        border: Polygon | undefined,
        holes: Polygon[] | undefined,
        labelID: number | undefined
    ): Promise<Region> {
        throw new Error("Method not implemented.");
    }

    public async deleteRegion(
        ofImageID: number,
        regionID: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async getRegionSnapshotListOfImage(
        ofImageID: number,
        atStatus: _ImageStatus_Values
    ): Promise<Region[]> {
        throw new Error("Method not implemented.");
    }
}
