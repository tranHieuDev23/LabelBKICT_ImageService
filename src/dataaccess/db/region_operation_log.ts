import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { _RegionOperationType_Values } from "../../proto/gen/RegionOperationType";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionOperationLog } from "./models";

export interface CreateRegionOperationLogArguments {
    ofRegionId: number;
    byUserId: number;
    operationTime: number;
    operationType: _RegionOperationType_Values;
}

export interface RegionOperationLogDataAccessor {
    createRegionOperationLog(
        args: CreateRegionOperationLogArguments
    ): Promise<number>;
    getRegionOperationLogListOfRegion(
        regionId: number
    ): Promise<RegionOperationLog[]>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: RegionOperationLogDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionOperationLog =
    "image_service_region_operation_log_tab";
const ColNameImageServiceRegionOperationLogId = "region_operation_log_id";
const ColNameImageServiceRegionOperationLogOfRegionId = "of_region_id";
const ColNameImageServiceRegionOperationLogByUserId = "by_user_id";
const ColNameImageServiceRegionOperationLogOperationTime = "operation_time";
const ColNameImageServiceRegionOperationLogOperationType = "operation_type";

export class RegionOperationLogDataAccessorImpl
    implements RegionOperationLogDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createRegionOperationLog(
        args: CreateRegionOperationLogArguments
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionOperationLogOfRegionId]:
                        args.ofRegionId,
                    [ColNameImageServiceRegionOperationLogByUserId]:
                        args.byUserId,
                    [ColNameImageServiceRegionOperationLogOperationTime]:
                        args.operationTime,
                    [ColNameImageServiceRegionOperationLogOperationType]:
                        args.operationType,
                })
                .returning(ColNameImageServiceRegionOperationLogId)
                .into(TabNameImageServiceRegionOperationLog);
            return +rows[0][ColNameImageServiceRegionOperationLogId];
        } catch (error) {
            this.logger.error("failed to create region operation log", {
                args,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionOperationLogListOfRegion(
        regionId: number
    ): Promise<RegionOperationLog[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionOperationLog)
                .where(
                    ColNameImageServiceRegionOperationLogOfRegionId,
                    "=",
                    regionId
                );
            return rows.map((row) => this.getRegionOperationLogFromRow(row));
        } catch (error) {
            this.logger.error(
                "failed to get region operation log list of region",
                { regionId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (
            dataAccessor: RegionOperationLogDataAccessor
        ) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new RegionOperationLogDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getRegionOperationLogFromRow(
        row: Record<string, any>
    ): RegionOperationLog {
        return new RegionOperationLog(
            +row[ColNameImageServiceRegionOperationLogId],
            +row[ColNameImageServiceRegionOperationLogOfRegionId],
            +row[ColNameImageServiceRegionOperationLogByUserId],
            +row[ColNameImageServiceRegionOperationLogOperationTime],
            +row[ColNameImageServiceRegionOperationLogOperationType]
        );
    }
}

injected(RegionOperationLogDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN =
    token<RegionOperationLogDataAccessor>("RegionOperationLogDataAccessor");
