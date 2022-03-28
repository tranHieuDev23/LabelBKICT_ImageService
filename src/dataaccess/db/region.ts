import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { BinaryConverter, BINARY_CONVERTER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { Polygon, Region, RegionLabel } from "./models";

export interface CreateRegionArguments {
    ofImageId: number;
    drawnByUserId: number;
    labeledByUserId: number;
    border: Polygon;
    holes: Polygon[];
    labeId: number | null;
}

export interface UpdateRegionArguments {
    id: number;
    drawnByUserId: number;
    labeledByUserId: number;
    border: Polygon;
    holes: Polygon[];
    labelId: number | null;
}

export interface RegionDataAccessor {
    createRegion(args: CreateRegionArguments): Promise<number>;
    getRegionListOfImage(imageId: number): Promise<Region[]>;
    getRegionListOfImageList(imageIdList: number[]): Promise<Region[][]>;
    getRegion(id: number): Promise<Region | null>;
    getRegionWithXLock(id: number): Promise<Region | null>;
    updateRegion(args: UpdateRegionArguments): Promise<void>;
    updateLabelOfRegionOfImage(
        imageId: number,
        labeId: number | null
    ): Promise<void>;
    deleteRegion(id: number): Promise<void>;
    getOfImageIdListOfRegionLabelList(
        regionLabelIdList: number[]
    ): Promise<number[][]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegion = "image_service_region_tab";
const ColNameImageServiceRegionId = "region_id";
const ColNameImageServiceRegionOfImageId = "of_image_id";
const ColNameImageServiceRegionDrawnByUserId = "drawn_by_user_id";
const ColNameImageServiceRegionLabeledByUserId = "labeled_by_user_id";
const ColNameImageServiceRegionBorder = "border";
const ColNameImageServiceRegionHoles = "holes";
const ColNameImageServiceRegionLabelId = "label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelRegionLabelId = "region_label_id";
const ColNameImageServiceRegionLabelOfImageTypeId = "of_image_type_id";
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
                    [ColNameImageServiceRegionOfImageId]: args.ofImageId,
                    [ColNameImageServiceRegionDrawnByUserId]:
                        args.drawnByUserId,
                    [ColNameImageServiceRegionLabeledByUserId]:
                        args.labeledByUserId,
                    [ColNameImageServiceRegionBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionLabelId]: args.labeId,
                })
                .returning(ColNameImageServiceRegionId)
                .into(TabNameImageServiceRegion);
            return +rows[0][ColNameImageServiceRegionId];
        } catch (error) {
            this.logger.error("failed to create region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionListOfImage(imageId: number): Promise<Region[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelId}`
                )
                .where({
                    [ColNameImageServiceRegionOfImageId]: imageId,
                });
            return rows.map((row) => this.getRegionFromJoinedRow(row));
        } catch (error) {
            this.logger.error("failed to get region list of image", {
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionListOfImageList(
        imageIdList: number[]
    ): Promise<Region[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelId}`
                )
                .whereIn(ColNameImageServiceRegionOfImageId, imageIdList);

            const imageIdToRegionList = new Map<number, Region[]>();
            for (const row of rows) {
                const imageId = +row[ColNameImageServiceRegionOfImageId];
                if (!imageIdToRegionList.has(imageId)) {
                    imageIdToRegionList.set(imageId, []);
                }
                imageIdToRegionList
                    .get(imageId)
                    ?.push(this.getRegionFromJoinedRow(row));
            }

            const results: Region[][] = [];
            for (const imageId of imageIdList) {
                results.push(imageIdToRegionList.get(imageId) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get region list of image list", {
                imageId: imageIdList,
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
                    `${TabNameImageServiceRegion}.${ColNameImageServiceRegionLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelId}`
                )
                .where({
                    [ColNameImageServiceRegionId]: id,
                });
        } catch (error) {
            this.logger.error("failed to get region", {
                regionId: id,
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
                .where({
                    [ColNameImageServiceRegionId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get region", {
                regionId: id,
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
        return this.getRegionFromRow(rows[0]);
    }

    public async updateRegion(args: UpdateRegionArguments): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegion)
                .update({
                    [ColNameImageServiceRegionDrawnByUserId]:
                        args.drawnByUserId,
                    [ColNameImageServiceRegionLabeledByUserId]:
                        args.labeledByUserId,
                    [ColNameImageServiceRegionBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionLabelId]: args.labelId,
                })
                .where({
                    [ColNameImageServiceRegionId]: args.id,
                });
        } catch (error) {
            this.logger.error("failed to update region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateLabelOfRegionOfImage(
        imageId: number,
        labeId: number | null
    ): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegion)
                .update({
                    [ColNameImageServiceRegionLabelId]: labeId,
                })
                .where({ [ColNameImageServiceRegionOfImageId]: imageId });
        } catch (error) {
            this.logger.error("failed to update region list", {
                imageId,
                labeId,
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
                    [ColNameImageServiceRegionId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete region", {
                regionId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no region with image_id region", {
                regionId: id,
            });
            throw new ErrorWithStatus(
                `no region with region_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async getOfImageIdListOfRegionLabelList(
        regionLabelIdList: number[]
    ): Promise<number[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .whereIn(ColNameImageServiceRegionLabelId, regionLabelIdList);

            const regionLabelIdToImageIdList = new Map<number, number[]>();
            for (const row of rows) {
                const regionLabelId = +row[ColNameImageServiceRegionLabelId];
                if (!regionLabelIdToImageIdList.has(regionLabelId)) {
                    regionLabelIdToImageIdList.set(regionLabelId, []);
                }
                regionLabelIdToImageIdList
                    .get(regionLabelId)
                    ?.push(+row[ColNameImageServiceRegionOfImageId]);
            }

            const results: number[][] = [];
            for (const regionLabelId of regionLabelIdList) {
                results.push(
                    regionLabelIdToImageIdList.get(regionLabelId) || []
                );
            }
            return results;
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

    private getRegionFromRow(row: Record<string, any>): Region {
        let label: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionLabelId]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionLabelId],
                0,
                "",
                ""
            );
        }
        return new Region(
            +row[ColNameImageServiceRegionId],
            +row[ColNameImageServiceRegionOfImageId],
            +row[ColNameImageServiceRegionDrawnByUserId],
            +row[ColNameImageServiceRegionLabeledByUserId],
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionBorder]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionHoles]
            ),
            label
        );
    }

    private getRegionFromJoinedRow(row: Record<string, any>): Region {
        let label: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionLabelId]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionLabelId],
                +row[ColNameImageServiceRegionLabelOfImageTypeId],
                row[ColNameImageServiceRegionLabelDisplayName],
                row[ColNameImageServiceRegionLabelColor]
            );
        }
        return new Region(
            +row[ColNameImageServiceRegionId],
            +row[ColNameImageServiceRegionOfImageId],
            +row[ColNameImageServiceRegionDrawnByUserId],
            +row[ColNameImageServiceRegionLabeledByUserId],
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
