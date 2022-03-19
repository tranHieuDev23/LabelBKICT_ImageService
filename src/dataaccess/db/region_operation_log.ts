import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionOperationType, RegionOperationLog } from "./models";

export interface CreateRegionOperationLogArguments {
    ofRegionID: number;
    byUserID: number;
    operationTime: number;
    operationType: RegionOperationType;
}

export interface RegionOperationLogDataAccessor {
    createRegionOperationLog(
        args: CreateRegionOperationLogArguments
    ): Promise<number>;
    getRegionOperationLogListOfRegion(
        regionID: number
    ): Promise<RegionOperationLog[]>;
}

const TabNameImageServiceRegionOperationLog =
    "image_service_region_operation_log_tab";
const ColNameImageServiceRegionOperationLogID = "id";
const ColNameImageServiceRegionOperationLogOfRegionID = "of_region_id";
const ColNameImageServiceRegionOperationLogByUserID = "by_user_id";
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
                    [ColNameImageServiceRegionOperationLogOfRegionID]:
                        args.ofRegionID,
                    [ColNameImageServiceRegionOperationLogByUserID]:
                        args.byUserID,
                    [ColNameImageServiceRegionOperationLogOperationTime]:
                        args.operationTime,
                    [ColNameImageServiceRegionOperationLogOperationType]:
                        args.operationType,
                })
                .returning(ColNameImageServiceRegionOperationLogID)
                .into(TabNameImageServiceRegionOperationLog);
            return +rows[0][ColNameImageServiceRegionOperationLogID];
        } catch (error) {
            this.logger.error("failed to create region operation log", {
                args,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionOperationLogListOfRegion(
        regionID: number
    ): Promise<RegionOperationLog[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionOperationLog)
                .where(
                    ColNameImageServiceRegionOperationLogOfRegionID,
                    "=",
                    regionID
                );
            return rows.map((row) => this.getRegionOperationLogFromRow(row));
        } catch (error) {
            this.logger.error(
                "failed to get region operation log list of region",
                { regionID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    private getRegionOperationLogFromRow(
        row: Record<string, any>
    ): RegionOperationLog {
        return new RegionOperationLog(
            +row[ColNameImageServiceRegionOperationLogID],
            +row[ColNameImageServiceRegionOperationLogOfRegionID],
            +row[ColNameImageServiceRegionOperationLogByUserID],
            +row[ColNameImageServiceRegionOperationLogOperationTime],
            +row[ColNameImageServiceRegionOperationLogOperationType]
        );
    }
}

injected(RegionOperationLogDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN =
    token<RegionOperationLogDataAccessor>("RegionOperationLogDataAccessor");