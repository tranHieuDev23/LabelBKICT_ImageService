import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionLabel, RegionOperationLogLabelMetadata } from "./models";

export interface CreateRegionOperationLogLabelMetadataArguments {
    ofLogId: number;
    oldLabelId: number | null;
    newLabelId: number | null;
}

export interface RegionOperationLogLabelMetadataDataAccessor {
    createRegionOperationLogLabelMetadata(
        args: CreateRegionOperationLogLabelMetadataArguments
    ): Promise<void>;
    getRegionOperationLogLabelMetadataOfLog(
        logId: number
    ): Promise<RegionOperationLogLabelMetadata | null>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: RegionOperationLogLabelMetadataDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionOperationLogLabelMetadata =
    "image_service_region_operation_log_label_metadata_tab";
const ColNameImageServiceRegionOperationLogLabelMetadataOfLogId =
    "of_region_operation_log_id";
const ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId =
    "old_label_id";
const ColNameImageServiceRegionOperationLogLabelMetadataNewLabelId =
    "new_label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelId = "region_label_id";
const ColNameImageServiceRegionLabelOfImageTypeId = "of_image_type_id";
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
                    [ColNameImageServiceRegionOperationLogLabelMetadataOfLogId]:
                        args.ofLogId,
                    [ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId]:
                        args.oldLabelId,
                    [ColNameImageServiceRegionOperationLogLabelMetadataNewLabelId]:
                        args.newLabelId,
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
        logId: number
    ): Promise<RegionOperationLogLabelMetadata | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionOperationLogLabelMetadata)
                .leftOuterJoin(
                    { old_label: TabNameImageServiceRegionLabel },
                    `${TabNameImageServiceRegionOperationLogLabelMetadata}.${ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelId}`
                )
                .leftOuterJoin(
                    { new_label: TabNameImageServiceRegionLabel },
                    `${TabNameImageServiceRegionOperationLogLabelMetadata}.${ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelId}`
                )
                .where(
                    ColNameImageServiceRegionOperationLogLabelMetadataOfLogId,
                    "=",
                    logId
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
                { logId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (
            dataAccessor: RegionOperationLogLabelMetadataDataAccessor
        ) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor =
                new RegionOperationLogLabelMetadataDataAccessorImpl(
                    tx,
                    this.logger
                );
            return executeFunc(txDataAccessor);
        });
    }

    private getRegionOperationLogLabelMetadataFromJoinedRow(
        row: Record<string, any>
    ): RegionOperationLogLabelMetadata {
        let oldLabel: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId]) {
            oldLabel = new RegionLabel(
                +row[
                    ColNameImageServiceRegionOperationLogLabelMetadataOldLabelId
                ],
                +row[
                    `old_label.${ColNameImageServiceRegionLabelOfImageTypeId}`
                ],
                row[`old_label.${ColNameImageServiceRegionLabelDisplayName}`],
                row[`old_label.${ColNameImageServiceRegionLabelColor}`]
            );
        }
        let newLabel: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionOperationLogLabelMetadataNewLabelId]) {
            newLabel = new RegionLabel(
                +row[
                    ColNameImageServiceRegionOperationLogLabelMetadataNewLabelId
                ],
                +row[
                    `new_label.${`old_label.${ColNameImageServiceRegionLabelOfImageTypeId}`}`
                ],
                row[`new_label.${ColNameImageServiceRegionLabelDisplayName}`],
                row[`new_label.${ColNameImageServiceRegionLabelColor}`]
            );
        }
        return new RegionOperationLogLabelMetadata(
            +row[ColNameImageServiceRegionOperationLogLabelMetadataOfLogId],
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
