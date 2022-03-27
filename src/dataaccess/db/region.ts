import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { BinaryConverter, BINARY_CONVERTER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { Polygon, Region, RegionLabel } from "./models";

export interface CreateRegionArguments {
    ofImageID: number;
    drawnByUserID: number;
    labeledByUserID: number;
    border: Polygon;
    holes: Polygon[];
    labelID: number | null;
}

export interface UpdateRegionArguments {
    id: number;
    drawnByUserID: number;
    labeledByUserID: number;
    border: Polygon;
    holes: Polygon[];
    labelID: number | null;
}

export interface RegionDataAccessor {
    createRegion(args: CreateRegionArguments): Promise<number>;
    getRegionListOfImage(imageID: number): Promise<Region[]>;
    getRegionListOfImageList(imageIDList: number[]): Promise<Region[][]>;
    getRegion(id: number): Promise<Region | null>;
    getRegionWithXLock(id: number): Promise<Region | null>;
    updateRegion(args: UpdateRegionArguments): Promise<void>;
    updateLabelOfRegionOfImage(
        imageID: number,
        labelID: number | null
    ): Promise<void>;
    deleteRegion(id: number): Promise<void>;
    getOfImageIDListOfRegionLabelList(
        regionLabelIDList: number[]
    ): Promise<number[]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegion = "image_service_region_tab";
const ColNameImageServiceRegionID = "region_id";
const ColNameImageServiceRegionOfImageID = "of_image_id";
const ColNameImageServiceRegionDrawnByUserID = "drawn_by_user_id";
const ColNameImageServiceRegionLabeledByUserID = "labeled_by_user_id";
const ColNameImageServiceRegionBorder = "border";
const ColNameImageServiceRegionHoles = "holes";
const ColNameImageServiceRegionLabelID = "label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelRegionLabelID = "region_label_id";
const ColNameImageServiceRegionLabelOfImageTypeID = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionDataAccessorImpl implements RegionDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly binaryConverter: BinaryConverter,
        private readonly logger: Logger
    ) {}

    public async createRegion(args: CreateRegionArguments): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionOfImageID]: args.ofImageID,
                    [ColNameImageServiceRegionDrawnByUserID]:
                        args.drawnByUserID,
                    [ColNameImageServiceRegionLabeledByUserID]:
                        args.labeledByUserID,
                    [ColNameImageServiceRegionBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionLabelID]: args.labelID,
                })
                .returning(ColNameImageServiceRegionID)
                .into(TabNameImageServiceRegion);
            return +rows[0][ColNameImageServiceRegionID];
        } catch (error) {
            this.logger.error("failed to create region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionListOfImage(imageID: number): Promise<Region[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelID}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelID}`
                )
                .where({
                    [ColNameImageServiceRegionOfImageID]: imageID,
                });
            return rows.map((row) => this.getRegionFromJoinedRow(row));
        } catch (error) {
            this.logger.error("failed to get region list of image", {
                imageID,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionListOfImageList(
        imageIDList: number[]
    ): Promise<Region[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelID}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelID}`
                )
                .whereIn(ColNameImageServiceRegionOfImageID, imageIDList);

            const imageIDToRegionList = new Map<number, Region[]>();
            for (const row of rows) {
                const imageID = +row[ColNameImageServiceRegionOfImageID];
                if (!imageIDToRegionList.has(imageID)) {
                    imageIDToRegionList.set(imageID, []);
                }
                imageIDToRegionList
                    .get(imageID)
                    ?.push(this.getRegionFromJoinedRow(row));
            }

            const results: Region[][] = [];
            for (const imageID of imageIDList) {
                results.push(imageIDToRegionList.get(imageID) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get region list of image list", {
                imageID: imageIDList,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegion(id: number): Promise<Region | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelID}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelID}`
                )
                .where({
                    [ColNameImageServiceRegionID]: id,
                });
        } catch (error) {
            this.logger.error("failed to get region", {
                regionID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no region with region_id found", { id });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one region with region_id found", {
                id,
            });
            throw new ErrorWithStatus(
                `more than one region with region_id ${id}`,
                status.INTERNAL
            );
        }
        return this.getRegionFromJoinedRow(rows[0]);
    }

    public async getRegionWithXLock(id: number): Promise<Region | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelID}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelID}`
                )
                .where({
                    [ColNameImageServiceRegionID]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get region", {
                regionID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no region with region_id found", { id });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one region with region_id found", {
                id,
            });
            throw new ErrorWithStatus(
                `more than one region with region_id ${id}`,
                status.INTERNAL
            );
        }
        return this.getRegionFromJoinedRow(rows[0]);
    }

    public async updateRegion(args: UpdateRegionArguments): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegion)
                .update({
                    [ColNameImageServiceRegionDrawnByUserID]:
                        args.drawnByUserID,
                    [ColNameImageServiceRegionLabeledByUserID]:
                        args.labeledByUserID,
                    [ColNameImageServiceRegionBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionLabelID]: args.labelID,
                })
                .where({
                    [ColNameImageServiceRegionID]: args.id,
                });
        } catch (error) {
            this.logger.error("failed to update region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateLabelOfRegionOfImage(
        imageID: number,
        labelID: number | null
    ): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegion)
                .update({
                    [ColNameImageServiceRegionLabelID]: labelID,
                })
                .where({ [ColNameImageServiceRegionOfImageID]: imageID });
        } catch (error) {
            this.logger.error("failed to update region list", {
                imageID,
                labelID,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteRegion(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceRegion)
                .where({
                    [ColNameImageServiceRegionID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete region", {
                regionID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no region with image_id region", {
                regionID: id,
            });
            throw new ErrorWithStatus(
                `no region with region_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async getOfImageIDListOfRegionLabelList(
        regionLabelIDList: number[]
    ): Promise<number[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .whereIn(ColNameImageServiceRegionLabelID, regionLabelIDList);
            return rows.map((row) => +row[ColNameImageServiceRegionOfImageID]);
        } catch (error) {
            this.logger.error(
                "failed to get of image id list of region label list"
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: RegionDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new RegionDataAccessorImpl(
                tx,
                this.binaryConverter,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getRegionFromJoinedRow(row: Record<string, any>): Region {
        let label: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionLabelID]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionLabelID],
                +row[ColNameImageServiceRegionLabelOfImageTypeID],
                row[ColNameImageServiceRegionLabelDisplayName],
                row[ColNameImageServiceRegionLabelColor]
            );
        }
        return new Region(
            +row[ColNameImageServiceRegionID],
            +row[ColNameImageServiceRegionOfImageID],
            +row[ColNameImageServiceRegionDrawnByUserID],
            +row[ColNameImageServiceRegionLabeledByUserID],
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionBorder]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionHoles]
            ),
            label
        );
    }
}

injected(
    RegionDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    BINARY_CONVERTER_TOKEN,
    LOGGER_TOKEN
);

export const REGION_DATA_ACCESSOR_TOKEN =
    token<RegionDataAccessor>("RegionDataAccessor");
