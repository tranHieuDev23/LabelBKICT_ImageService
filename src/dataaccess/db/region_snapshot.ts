import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ImageStatus } from "../../proto/gen/ImageStatus";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import {
    BinaryConverter,
    BINARY_CONVERTER_TOKEN,
} from "../../utils/binary_converter";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { Polygon, RegionSnapshot, RegionLabel } from "./models";

export interface CreateRegionSnapshotArguments {
    ofImageId: number;
    atStatus: ImageStatus;
    drawnByUserId: number;
    labeledByUserId: number;
    border: Polygon;
    holes: Polygon[];
    labelId: number | null;
}

export interface RegionSnapshotDataAccessor {
    createRegionSnapshot(args: CreateRegionSnapshotArguments): Promise<number>;
    getRegionSnapshotListOfImageAtStatus(
        imageId: number,
        imageStatus: ImageStatus
    ): Promise<RegionSnapshot[]>;
    deleteRegionSnapshotListOfImageAtStatus(
        imageId: number,
        imageStatus: ImageStatus
    ): Promise<void>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionSnapshotDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionSnapshot = "image_service_region_snapshot_tab";
const ColNameImageServiceRegionSnapshotId = "region_snapshot_id";
const ColNameImageServiceRegionSnapshotOfImageId = "of_image_id";
const ColNameImageServiceRegionSnapshotAtStatus = "at_status";
const ColNameImageServiceRegionSnapshotDrawnByUserId = "drawn_by_user_id";
const ColNameImageServiceRegionSnapshotLabeledByUserId = "labeled_by_user_id";
const ColNameImageServiceRegionSnapshotBorder = "border";
const ColNameImageServiceRegionSnapshotHoles = "holes";
const ColNameImageServiceRegionSnapshotLabelId = "label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelRegionLabelId = "region_label_id";
const ColNameImageServiceRegionLabelOfImageTypeId = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionSnapshotDataAccessorImpl
    implements RegionSnapshotDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly binaryConverter: BinaryConverter,
        private readonly logger: Logger
    ) {}

    public async createRegionSnapshot(
        args: CreateRegionSnapshotArguments
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionSnapshotOfImageId]:
                        args.ofImageId,
                    [ColNameImageServiceRegionSnapshotAtStatus]: args.atStatus,
                    [ColNameImageServiceRegionSnapshotDrawnByUserId]:
                        args.drawnByUserId,
                    [ColNameImageServiceRegionSnapshotLabeledByUserId]:
                        args.labeledByUserId,
                    [ColNameImageServiceRegionSnapshotBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionSnapshotHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionSnapshotLabelId]: args.labelId,
                })
                .returning(ColNameImageServiceRegionSnapshotId)
                .into(TabNameImageServiceRegionSnapshot);
            return +rows[0][ColNameImageServiceRegionSnapshotId];
        } catch (error) {
            this.logger.error("failed to create region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionSnapshotListOfImageAtStatus(
        imageId: number,
        imageStatus: ImageStatus
    ): Promise<RegionSnapshot[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionSnapshot)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    `${TabNameImageServiceRegionSnapshot}.${ColNameImageServiceRegionSnapshotLabelId}`,
                    `${TabNameImageServiceRegionLabel}.${ColNameImageServiceRegionLabelRegionLabelId}`
                )
                .where({
                    [ColNameImageServiceRegionSnapshotOfImageId]: imageId,
                    [ColNameImageServiceRegionSnapshotAtStatus]: imageStatus,
                });
            return rows.map((row) => this.getRegionFromJoinedRow(row));
        } catch (error) {
            this.logger.error(
                "failed to get region snapshot list of image at status",
                {
                    imageId,
                    imageStatus,
                    error,
                }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteRegionSnapshotListOfImageAtStatus(
        imageId: number,
        imageStatus: ImageStatus
    ): Promise<void> {
        try {
            await this.knex
                .delete()
                .from(TabNameImageServiceRegionSnapshot)
                .where({
                    [ColNameImageServiceRegionSnapshotOfImageId]: imageId,
                    [ColNameImageServiceRegionSnapshotAtStatus]: imageStatus,
                });
        } catch (error) {
            this.logger.error(
                "failed to delete region snapshot list of image at status",
                {
                    imageId,
                    imageStatus,
                    error,
                }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: RegionSnapshotDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new RegionSnapshotDataAccessorImpl(
                tx,
                this.binaryConverter,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getRegionFromJoinedRow(row: Record<string, any>): RegionSnapshot {
        let label: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionSnapshotLabelId]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionSnapshotLabelId],
                +row[ColNameImageServiceRegionLabelOfImageTypeId],
                row[ColNameImageServiceRegionLabelDisplayName],
                row[ColNameImageServiceRegionLabelColor]
            );
        }
        const border = this.binaryConverter.fromBuffer(
            row[ColNameImageServiceRegionSnapshotBorder]
        );
        const holes = this.binaryConverter.fromBuffer(
            row[ColNameImageServiceRegionSnapshotHoles]
        );
        return new RegionSnapshot(
            +row[ColNameImageServiceRegionSnapshotId],
            +row[ColNameImageServiceRegionSnapshotDrawnByUserId],
            +row[ColNameImageServiceRegionSnapshotLabeledByUserId],
            border,
            holes,
            label
        );
    }
}

injected(
    RegionSnapshotDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    BINARY_CONVERTER_TOKEN,
    LOGGER_TOKEN
);

export const REGION_SNAPSHOT_DATA_ACCESSOR_TOKEN =
    token<RegionSnapshotDataAccessor>("RegionSnapshotDataAccessor");
