import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionLabel, RegionOperationLogLabelMetadata } from "./models";

export interface CreateRegionOperationLogLabelMetadataArguments {
    ofLogID: number;
    oldLabelID: number | null;
    newLabelID: number | null;
}

export interface RegionOperationLogLabelMetadataDataAccessor {
    createRegionOperationLogLabelMetadata(
        args: CreateRegionOperationLogLabelMetadataArguments
    ): Promise<void>;
    getRegionOperationLogLabelMetadataOfLog(
        logID: number
    ): Promise<RegionOperationLogLabelMetadata | null>;
}

const TabNameImageServiceRegionOperationLogLabelMetadata =
    "image_service_region_operation_log_draw_metadata_tab";
const ColNameImageServiceRegionOperationLogLabelMetadataOfLogID = "of_log_id";
const ColNameImageServiceRegionOperationLogLabelMetadataOldLabelID =
    "old_label_id";
const ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID =
    "new_label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelID = "id";
const ColNameImageServiceRegionLabelOfImageTypeID = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionOperationLogLabelMetadataDataAccessorImpl
    implements RegionOperationLogLabelMetadataDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createRegionOperationLogLabelMetadata(
        args: CreateRegionOperationLogLabelMetadataArguments
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceRegionOperationLogLabelMetadataOfLogID]:
                        args.ofLogID,
                    [ColNameImageServiceRegionOperationLogLabelMetadataOldLabelID]:
                        args.oldLabelID,
                    [ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID]:
                        args.newLabelID,
                })
                .into(TabNameImageServiceRegionOperationLogLabelMetadata);
        } catch (error) {
            this.logger.error(
                "failed to create region operation log label metadata",
                { args, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionOperationLogLabelMetadataOfLog(
        logID: number
    ): Promise<RegionOperationLogLabelMetadata | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionOperationLogLabelMetadata)
                .leftOuterJoin(
                    { old_label: TabNameImageServiceRegionLabel },
                    ColNameImageServiceRegionOperationLogLabelMetadataOldLabelID,
                    ColNameImageServiceRegionLabelID
                )
                .leftOuterJoin(
                    { new_label: TabNameImageServiceRegionLabel },
                    ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID,
                    ColNameImageServiceRegionLabelID
                )
                .where(
                    ColNameImageServiceRegionOperationLogLabelMetadataOfLogID,
                    "=",
                    logID
                );
            if (rows.length === 0) {
                return null;
            }
            return this.getRegionOperationLogLabelMetadataFromJoinedRow(
                rows[0]
            );
        } catch (error) {
            this.logger.error(
                "failed to get region operation log label metadata of log",
                { logID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    private getRegionOperationLogLabelMetadataFromJoinedRow(
        row: Record<string, any>
    ): RegionOperationLogLabelMetadata {
        let oldLabel: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionOperationLogLabelMetadataOldLabelID]) {
            oldLabel = new RegionLabel(
                +row[
                    ColNameImageServiceRegionOperationLogLabelMetadataOldLabelID
                ],
                +row[
                    `old_label.${ColNameImageServiceRegionLabelOfImageTypeID}`
                ],
                row[`old_label.${ColNameImageServiceRegionLabelDisplayName}`],
                row[`old_label.${ColNameImageServiceRegionLabelColor}`]
            );
        }
        let newLabel: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID]) {
            newLabel = new RegionLabel(
                +row[
                    ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID
                ],
                +row[
                    `new_label.${`old_label.${ColNameImageServiceRegionLabelOfImageTypeID}`}`
                ],
                row[`new_label.${ColNameImageServiceRegionLabelDisplayName}`],
                row[`new_label.${ColNameImageServiceRegionLabelColor}`]
            );
        }
        if (row[ColNameImageServiceRegionOperationLogLabelMetadataNewLabelID]) {
        }
        return new RegionOperationLogLabelMetadata(
            +row[ColNameImageServiceRegionOperationLogLabelMetadataOfLogID],
            oldLabel,
            newLabel
        );
    }
}

injected(
    RegionOperationLogLabelMetadataDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    LOGGER_TOKEN
);

export const REGION_OPERATION_LOG_LABEL_METADATA_DATA_ACCESSOR_TOKEN =
    token<RegionOperationLogLabelMetadataDataAccessor>(
        "RegionOperationLogLabelMetadataDataAccessor"
    );
