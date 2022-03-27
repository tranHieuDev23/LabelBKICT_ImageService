import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionLabel } from "./models";

export interface RegionLabelDataAccessor {
    createRegionLabel(
        ofImageTypeId: number,
        displayName: string,
        color: string
    ): Promise<number>;
    getRegionLabelListOfImageTypeIdList(
        imageTypeIdList: number[]
    ): Promise<RegionLabel[][]>;
    getRegionLabel(id: number): Promise<RegionLabel | null>;
    getRegionLabelWithXLock(id: number): Promise<RegionLabel | null>;
    updateRegionLabel(regionLabel: RegionLabel): Promise<void>;
    deleteRegionLabel(id: number): Promise<void>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionLabelDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelId = "region_label_id";
const ColNameImageServiceRegionLabelOfImageTypeId = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionLabelDataAccessorImpl implements RegionLabelDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createRegionLabel(
        ofImageTypeId: number,
        displayName: string,
        color: string
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionLabelOfImageTypeId]:
                        ofImageTypeId,
                    [ColNameImageServiceRegionLabelDisplayName]: displayName,
                    [ColNameImageServiceRegionLabelColor]: color,
                })
                .returning(ColNameImageServiceRegionLabelId)
                .into(TabNameImageServiceRegionLabel);
            return +rows[0][ColNameImageServiceRegionLabelId];
        } catch (error) {
            this.logger.error("failed to create region label", {
                displayName,
                hasPredictiveModel: color,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionLabelListOfImageTypeIdList(
        imageTypeIdList: number[]
    ): Promise<RegionLabel[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionLabel)
                .whereIn(
                    ColNameImageServiceRegionLabelOfImageTypeId,
                    imageTypeIdList
                );

            const imageTypeIdToRegionLabelList = new Map<
                number,
                RegionLabel[]
            >();
            for (const row of rows) {
                const imageTypeId =
                    +row[ColNameImageServiceRegionLabelOfImageTypeId];
                if (!imageTypeIdToRegionLabelList.has(imageTypeId)) {
                    imageTypeIdToRegionLabelList.set(imageTypeId, []);
                }
                imageTypeIdToRegionLabelList
                    .get(imageTypeId)
                    ?.push(this.getRegionLabelFromRow(row));
            }

            const results: RegionLabel[][] = [];
            for (const imageTypeId of imageTypeIdList) {
                results.push(
                    imageTypeIdToRegionLabelList.get(imageTypeId) || []
                );
            }
            return results;
        } catch (error) {
            this.logger.error(
                "failed to get region label list of image type id list",
                { error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionLabel(id: number): Promise<RegionLabel | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionLabel)
                .where({
                    [ColNameImageServiceRegionLabelId]: id,
                });
        } catch (error) {
            this.logger.error("failed to get region label", {
                regionLabelId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no region label with region_label_id found", {
                regionLabelId: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error(
                "more than one region label with region_label_id found",
                { regionLabelId: id }
            );
            throw new ErrorWithStatus(
                "more than one region label was found",
                status.INTERNAL
            );
        }
        return this.getRegionLabelFromRow(rows[0]);
    }

    public async getRegionLabelWithXLock(
        id: number
    ): Promise<RegionLabel | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionLabel)
                .where({
                    [ColNameImageServiceRegionLabelId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get region label", {
                regionLabelId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no region label with region_label_id found", {
                regionLabelId: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error(
                "more than one region label with region_label_id found",
                { regionLabelId: id }
            );
            throw new ErrorWithStatus(
                "more than one region label was found",
                status.INTERNAL
            );
        }
        return this.getRegionLabelFromRow(rows[0]);
    }

    public async updateRegionLabel(regionLabel: RegionLabel): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegionLabel)
                .update({
                    [ColNameImageServiceRegionLabelOfImageTypeId]:
                        regionLabel.ofImageTypeId,
                    [ColNameImageServiceRegionLabelDisplayName]:
                        regionLabel.displayName,
                    [ColNameImageServiceRegionLabelColor]: regionLabel.color,
                })
                .where({
                    [ColNameImageServiceRegionLabelId]: regionLabel.id,
                });
        } catch (error) {
            this.logger.error("failed to update region label", {
                imageType: regionLabel,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteRegionLabel(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceRegionLabel)
                .where({
                    [ColNameImageServiceRegionLabelId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete region label", {
                regionLabelId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no region label with region_label_id found", {
                regionLabelId: id,
            });
            throw new ErrorWithStatus(
                `no region label with region_label_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: RegionLabelDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new RegionLabelDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getRegionLabelFromRow(row: Record<string, any>): RegionLabel {
        return new RegionLabel(
            +row[ColNameImageServiceRegionLabelId],
            +row[ColNameImageServiceRegionLabelOfImageTypeId],
            row[ColNameImageServiceRegionLabelDisplayName],
            row[ColNameImageServiceRegionLabelColor]
        );
    }
}

injected(RegionLabelDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const REGION_LABEL_DATA_ACCESSOR_TOKEN = token<RegionLabelDataAccessor>(
    "RegionLabelDataAccessor"
);
