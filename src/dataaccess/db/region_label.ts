import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionLabel } from "./models";

export interface RegionLabelDataAccessor {
    createRegionLabel(
        ofImageTypeID: number,
        displayName: string,
        color: string
    ): Promise<number>;
    getRegionLabelListOfImageTypeIDList(
        imageTypeIDList: number[]
    ): Promise<RegionLabel[][]>;
    getRegionLabelWithXLock(id: number): Promise<RegionLabel | null>;
    updateRegionLabel(regionLabel: RegionLabel): Promise<void>;
    deleteRegionLabel(id: number): Promise<void>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionLabelDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelID = "id";
const ColNameImageServiceRegionLabelOfImageTypeID = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionLabelDataAccessorImpl implements RegionLabelDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createRegionLabel(
        ofImageTypeID: number,
        displayName: string,
        color: string
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionLabelOfImageTypeID]:
                        ofImageTypeID,
                    [ColNameImageServiceRegionLabelDisplayName]: displayName,
                    [ColNameImageServiceRegionLabelColor]: color,
                })
                .returning(ColNameImageServiceRegionLabelID)
                .into(TabNameImageServiceRegionLabel);
            return +rows[0][ColNameImageServiceRegionLabelID];
        } catch (error) {
            this.logger.error("failed to create region label", {
                displayName,
                hasPredictiveModel: color,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionLabelListOfImageTypeIDList(
        imageTypeIDList: number[]
    ): Promise<RegionLabel[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionLabel)
                .whereIn(
                    ColNameImageServiceRegionLabelOfImageTypeID,
                    imageTypeIDList
                );

            const imageTypeIDToRegionLabelList = new Map<
                number,
                RegionLabel[]
            >();
            for (const row of rows) {
                const imageTypeID =
                    +row[ColNameImageServiceRegionLabelOfImageTypeID];
                if (!imageTypeIDToRegionLabelList.has(imageTypeID)) {
                    imageTypeIDToRegionLabelList.set(imageTypeID, []);
                }
                imageTypeIDToRegionLabelList
                    .get(imageTypeID)
                    ?.push(this.getRegionLabelFromRow(row));
            }

            const results: RegionLabel[][] = [];
            for (const imageTypeID of imageTypeIDList) {
                results.push(
                    imageTypeIDToRegionLabelList.get(imageTypeID) || []
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

    public async getRegionLabelWithXLock(
        id: number
    ): Promise<RegionLabel | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionLabel)
                .where({
                    [ColNameImageServiceRegionLabelID]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get region label", {
                regionLabelID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no region label with region_label_id found", {
                regionLabelID: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error(
                "more than one region label with region_label_id found",
                { regionLabelID: id }
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
                    [ColNameImageServiceRegionLabelOfImageTypeID]:
                        regionLabel.ofImageTypeID,
                    [ColNameImageServiceRegionLabelDisplayName]:
                        regionLabel.displayName,
                    [ColNameImageServiceRegionLabelColor]: regionLabel.color,
                })
                .where({
                    [ColNameImageServiceRegionLabelID]: regionLabel.id,
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
                    [ColNameImageServiceRegionLabelID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete region label", {
                regionLabelID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no region label with region_label_id found", {
                regionLabelID: id,
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
            +row[ColNameImageServiceRegionLabelID],
            +row[ColNameImageServiceRegionLabelOfImageTypeID],
            row[ColNameImageServiceRegionLabelDisplayName],
            row[ColNameImageServiceRegionLabelColor]
        );
    }
}

injected(RegionLabelDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const REGION_LABEL_DATA_ACCESSOR_TOKEN = token<RegionLabelDataAccessor>(
    "RegionLabelDataAccessor"
);
