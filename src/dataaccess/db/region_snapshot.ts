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
    ofImageID: number;
    atStatus: ImageStatus;
    drawnByUserID: number;
    labeledByUserID: number;
    border: Polygon;
    holes: Polygon[];
    labelID: number | null;
}

export interface RegionSnapshotDataAccessor {
    createRegionSnapshot(args: CreateRegionSnapshotArguments): Promise<number>;
    getRegionSnapshotListOfImage(
        imageID: number,
        imageStatus: ImageStatus
    ): Promise<RegionSnapshot[]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionSnapshotDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegionSnapshot = "image_service_region_snapshot_tab";
const ColNameImageServiceRegionSnapshotID = "id";
const ColNameImageServiceRegionSnapshotOfImageID = "of_image_id";
const ColNameImageServiceRegionSnapshotAtStatus = "at_status";
const ColNameImageServiceRegionSnapshotDrawnByUserID = "drawn_by_user_id";
const ColNameImageServiceRegionSnapshotLabeledByUserID = "labeled_by_user_id";
const ColNameImageServiceRegionSnapshotBorder = "border";
const ColNameImageServiceRegionSnapshotHoles = "holes";
const ColNameImageServiceRegionSnapshotLabelID = "label_id";

const TabNameImageServiceRegionSnapshotLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionSnapshotLabelRegionLabelID = "id";
const ColNameImageServiceRegionSnapshotLabelOfImageTypeID = "of_image_type_id";
const ColNameImageServiceRegionSnapshotLabelDisplayName = "display_name";
const ColNameImageServiceRegionSnapshotLabelColor = "color";

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
                    [ColNameImageServiceRegionSnapshotOfImageID]:
                        args.ofImageID,
                    [ColNameImageServiceRegionSnapshotAtStatus]: args.atStatus,
                    [ColNameImageServiceRegionSnapshotDrawnByUserID]:
                        args.drawnByUserID,
                    [ColNameImageServiceRegionSnapshotLabeledByUserID]:
                        args.labeledByUserID,
                    [ColNameImageServiceRegionSnapshotBorder]:
                        this.binaryConverter.toBuffer(args.border),
                    [ColNameImageServiceRegionSnapshotHoles]:
                        this.binaryConverter.toBuffer(args.holes),
                    [ColNameImageServiceRegionSnapshotLabelID]: args.labelID,
                })
                .returning(ColNameImageServiceRegionSnapshotID)
                .into(TabNameImageServiceRegionSnapshot);
            return +rows[0][ColNameImageServiceRegionSnapshotID];
        } catch (error) {
            this.logger.error("failed to create region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionSnapshotListOfImage(
        imageID: number,
        imageStatus: ImageStatus
    ): Promise<RegionSnapshot[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegionSnapshot)
                .leftOuterJoin(
                    TabNameImageServiceRegionSnapshotLabel,
                    ColNameImageServiceRegionSnapshotLabelID,
                    ColNameImageServiceRegionSnapshotLabelRegionLabelID
                )
                .where({
                    [ColNameImageServiceRegionSnapshotOfImageID]: imageID,
                    [ColNameImageServiceRegionSnapshotAtStatus]: imageStatus,
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
        if (row[ColNameImageServiceRegionSnapshotLabelID]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionSnapshotLabelID],
                +row[ColNameImageServiceRegionSnapshotLabelOfImageTypeID],
                row[ColNameImageServiceRegionSnapshotLabelDisplayName],
                row[ColNameImageServiceRegionSnapshotLabelColor]
            );
        }
        return new RegionSnapshot(
            +row[ColNameImageServiceRegionSnapshotID],
            +row[ColNameImageServiceRegionSnapshotDrawnByUserID],
            +row[ColNameImageServiceRegionSnapshotLabeledByUserID],
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionSnapshotBorder]
            ),
            this.binaryConverter.fromBuffer(
                row[ColNameImageServiceRegionSnapshotHoles]
            ),
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
