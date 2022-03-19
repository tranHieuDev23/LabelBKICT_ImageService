import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { BinaryConverter, BINARY_CONVERTER_TOKEN } from "./binary_converter";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { Polygon, RegionOperationLogDrawMetadata } from "./models";

export interface CreateRegionOperationLogDrawMetadataArguments {
    ofLogID: number;
    oldBorder: Polygon;
    oldHoles: Polygon[];
    newBorder: Polygon;
    newHoles: Polygon[];
}

export interface RegionOperationLogDrawMetadataDataAccessor {
    createRegionOperationLogDrawMetadata(
        args: CreateRegionOperationLogDrawMetadataArguments
    ): Promise<void>;
    getRegionOperationLogDrawMetadataOfLog(
        logID: number
    ): Promise<RegionOperationLogDrawMetadata | null>;
}

const TabNameImageServiceRegionOperationLogDrawMetadata =
    "image_service_region_operation_log_draw_metadata_tab";
const ColNameImageServiceRegionOperationLogDrawMetadataOfLogID = "of_log_id";
const ColNameImageServiceRegionOperationLogDrawMetadataOldBorder = "old_border";
const ColNameImageServiceRegionOperationLogDrawMetadataOldHoles = "old_holes";
const ColNameImageServiceRegionOperationLogDrawMetadataNewBorder = "new_border";
const ColNameImageServiceRegionOperationLogDrawMetadataNewHoles = "new_holes";

export class RegionOperationLogDrawMetadataDataAccessorImpl
    implements RegionOperationLogDrawMetadataDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly binaryConverter: BinaryConverter,
        private readonly logger: Logger
    ) {}

    public async createRegionOperationLogDrawMetadata(
        args: CreateRegionOperationLogDrawMetadataArguments
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceRegionOperationLogDrawMetadataOfLogID]:
                        args.ofLogID,
                    [ColNameImageServiceRegionOperationLogDrawMetadataOldBorder]:
                        args.oldBorder,
                    [ColNameImageServiceRegionOperationLogDrawMetadataOldHoles]:
                        args.oldHoles,
                    [ColNameImageServiceRegionOperationLogDrawMetadataNewBorder]:
                        args.newBorder,
                    [ColNameImageServiceRegionOperationLogDrawMetadataNewHoles]:
                        args.newHoles,
                })
                .into(TabNameImageServiceRegionOperationLogDrawMetadata);
        } catch (error) {
            this.logger.error(
                "failed to create region operation log draw metadata",
                { args, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionOperationLogDrawMetadataOfLog(
        logID: number
    ): Promise<RegionOperationLogDrawMetadata | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionOperationLogDrawMetadata)
                .where(
                    ColNameImageServiceRegionOperationLogDrawMetadataOfLogID,
                    "=",
                    logID
                );
            if (rows.length === 0) {
                return null;
            }
            return this.getRegionOperationLogDrawMetadataFromRow(rows[0]);
        } catch (error) {
            this.logger.error(
                "failed to get region operation log draw metadata of log",
                { logID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    private getRegionOperationLogDrawMetadataFromRow(
        row: Record<string, any>
    ): RegionOperationLogDrawMetadata {
        return new RegionOperationLogDrawMetadata(
            +row[ColNameImageServiceRegionOperationLogDrawMetadataOfLogID],
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionOperationLogDrawMetadataOldBorder]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionOperationLogDrawMetadataOldHoles]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionOperationLogDrawMetadataNewBorder]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionOperationLogDrawMetadataNewHoles]
            )
        );
    }
}

injected(
    RegionOperationLogDrawMetadataDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    BINARY_CONVERTER_TOKEN,
    LOGGER_TOKEN
);

export const REGION_OPERATION_LOG_DRAW_METADATA_DATA_ACCESSOR_TOKEN =
    token<RegionOperationLogDrawMetadataDataAccessor>(
        "RegionOperationLogDrawMetadataDataAccessor"
    );
