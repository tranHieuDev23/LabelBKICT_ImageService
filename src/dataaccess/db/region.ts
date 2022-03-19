import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { RegionLabel } from "./region_label";

export class Vertex {
    constructor(public x: number, public y: number) {}
}

export class Polygon {
    constructor(public vertices: Vertex[]) {}
}

export class Region {
    constructor(
        public id: number,
        public drawnByUserID: number,
        public labeledByUserID: number,
        public border: Polygon,
        public holes: Polygon[],
        public label: RegionLabel | null
    ) {}
}

export interface CreateRegionArguments {
    ofImageID: number;
    drawnByUserID: number;
    labeledByUserID: number;
    border: Polygon;
    holes: Polygon[];
    labelID: number | null;
}

export interface UpdateRegionArguments {
    id: number;
    ofImageID: number;
    drawnByUserID: number;
    labeledByUserID: number;
    border: Polygon;
    holes: Polygon[];
    labelID: number | null;
}

export interface RegionDataAccessor {
    createRegion(args: CreateRegionArguments): Promise<number>;
    getRegionListOfImage(imageID: number): Promise<Region[]>;
    updateRegion(args: UpdateRegionArguments): Promise<void>;
    deleteRegion(id: number): Promise<void>;
    getOfImageIDListOfRegionLabelList(
        regionLabelIDList: number[]
    ): Promise<number[]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: RegionDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceRegion = "image_service_region_tab";
const ColNameImageServiceRegionID = "id";
const ColNameImageServiceRegionOfImageID = "of_image_id";
const ColNameImageServiceRegionDrawnByUserID = "drawn_by_user_id";
const ColNameImageServiceRegionLabeledByUserID = "labeled_by_user_id";
const ColNameImageServiceRegionBorder = "border";
const ColNameImageServiceRegionHoles = "holes";
const ColNameImageServiceRegionLabelID = "label_id";

const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const ColNameImageServiceRegionLabelRegionLabelID = "id";
const ColNameImageServiceRegionLabelOfImageTypeID = "of_image_type_id";
const ColNameImageServiceRegionLabelDisplayName = "display_name";
const ColNameImageServiceRegionLabelColor = "color";

export class RegionDataAccessorImpl implements RegionDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createRegion(args: CreateRegionArguments): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceRegionOfImageID]: args.ofImageID,
                    [ColNameImageServiceRegionDrawnByUserID]:
                        args.drawnByUserID,
                    [ColNameImageServiceRegionLabeledByUserID]:
                        args.labeledByUserID,
                    [ColNameImageServiceRegionBorder]:
                        this.encodeBorderIntoBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.encodeHolesIntoBuffer(args.holes),
                    [ColNameImageServiceRegionLabelID]: args.labelID,
                })
                .returning(ColNameImageServiceRegionID)
                .into(TabNameImageServiceRegion);
            return +rows[0][ColNameImageServiceRegionID];
        } catch (error) {
            this.logger.error("failed to create region", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getRegionListOfImage(imageID: number): Promise<Region[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .leftOuterJoin(
                    TabNameImageServiceRegionLabel,
                    ColNameImageServiceRegionLabelID,
                    ColNameImageServiceRegionLabelRegionLabelID
                )
                .where({
                    [ColNameImageServiceRegionOfImageID]: imageID,
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

    public async updateRegion(args: UpdateRegionArguments): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceRegion)
                .update({
                    [ColNameImageServiceRegionOfImageID]: args.ofImageID,
                    [ColNameImageServiceRegionDrawnByUserID]:
                        args.drawnByUserID,
                    [ColNameImageServiceRegionLabeledByUserID]:
                        args.labeledByUserID,
                    [ColNameImageServiceRegionBorder]:
                        this.encodeBorderIntoBuffer(args.border),
                    [ColNameImageServiceRegionHoles]:
                        this.encodeHolesIntoBuffer(args.holes),
                    [ColNameImageServiceRegionLabelID]: args.labelID,
                })
                .where({
                    [ColNameImageServiceRegionID]: args.id,
                });
        } catch (error) {
            this.logger.error("failed to update region", { args, error });
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
                    [ColNameImageServiceRegionID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete region", {
                regionID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no region with image_id region", {
                regionID: id,
            });
            throw new ErrorWithStatus(
                `no region with region_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async getOfImageIDListOfRegionLabelList(
        regionLabelIDList: number[]
    ): Promise<number[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceRegion)
                .whereIn(ColNameImageServiceRegionLabelID, regionLabelIDList);
            return rows.map((row) => +row[ColNameImageServiceRegionOfImageID]);
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
            const txDataAccessor = new RegionDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private encodeBorderIntoBuffer(border: Polygon): Buffer {
        return Buffer.from(JSON.stringify(border));
    }

    private encodeHolesIntoBuffer(holes: Polygon[]): Buffer {
        return Buffer.from(JSON.stringify(holes));
    }

    private decodeBorderIntoBuffer(buffer: Buffer): Polygon {
        return JSON.parse(buffer.toString());
    }

    private decodeHolesIntoBuffer(buffer: Buffer): Polygon[] {
        return JSON.parse(buffer.toString());
    }

    private getRegionFromJoinedRow(row: Record<string, any>): Region {
        let label: RegionLabel | null = null;
        if (row[ColNameImageServiceRegionLabelID]) {
            label = new RegionLabel(
                +row[ColNameImageServiceRegionLabelID],
                +row[ColNameImageServiceRegionLabelOfImageTypeID],
                row[ColNameImageServiceRegionLabelDisplayName],
                row[ColNameImageServiceRegionLabelColor]
            );
        }
        return new Region(
            +row[ColNameImageServiceRegionID],
            +row[ColNameImageServiceRegionDrawnByUserID],
            +row[ColNameImageServiceRegionLabeledByUserID],
            this.decodeBorderIntoBuffer(row[ColNameImageServiceRegionBorder]),
            this.decodeHolesIntoBuffer(row[ColNameImageServiceRegionHoles]),
            label
        );
    }
}

injected(RegionDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const REGION_DATA_ACCESSOR_TOKEN =
    token<RegionDataAccessor>("RegionDataAccessor");
