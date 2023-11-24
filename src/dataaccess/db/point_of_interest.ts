import { Logger } from "winston";
import { Vertex } from "./models";
import { Knex } from "knex";
import { ErrorWithStatus, LOGGER_TOKEN, TIMER_TOKEN, Timer } from "../../utils";
import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class PointOfInterest {
    constructor(
        public id: number,
        public ofImageId: number,
        public createdByUserId: number,
        public createdTime: number,
        public updatedTime: number,
        public coordinate: Vertex,
        public description: string
    ) {}
}

export interface PointOfInterestDataAccessor {
    createPointOfInterest(
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest>;
    getPointOfInterestListOfImage(imageId: number): Promise<PointOfInterest[]>;
    getPointOfInterestListOfImageList(imageIdList: number[]): Promise<PointOfInterest[][]>;
    getPointOfInterestWithXLock(id: number): Promise<PointOfInterest | null>;
    updatePointOfInterest(poi: PointOfInterest): Promise<PointOfInterest>;
    deletePointOfInterest(id: number): Promise<void>;
    withTransaction<T>(executeFunc: (dataAccessor: PointOfInterestDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServicePointOfInterest = "image_service_point_of_interest_tab";
const ColNameImageServicePointOfInterestId = "point_of_interest_id";
const ColNameImageServicePointOfInterestOfImageId = "of_image_id";
const ColNameImageServicePointOfInterestCreatedByUserId = "created_by_user_id";
const ColNameImageServicePointOfInterestCreatedTime = "created_time";
const ColNameImageServicePointOfInterestUpdatedTime = "updated_time";
const ColNameImageServicePointOfInterestX = "x";
const ColNameImageServicePointOfInterestY = "y";
const ColNameImageServicePointOfInterestDescription = "description";

export class PointOfInterestDataAccessorImpl implements PointOfInterestDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger,
        private readonly timer: Timer
    ) {}

    public async createPointOfInterest(
        ofImageId: number,
        createdByUserId: number,
        coordinate: Vertex,
        description: string
    ): Promise<PointOfInterest> {
        const currentTime = this.timer.getCurrentTime();
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServicePointOfInterestOfImageId]: ofImageId,
                    [ColNameImageServicePointOfInterestCreatedByUserId]: createdByUserId,
                    [ColNameImageServicePointOfInterestCreatedTime]: currentTime,
                    [ColNameImageServicePointOfInterestUpdatedTime]: currentTime,
                    [ColNameImageServicePointOfInterestX]: coordinate.x,
                    [ColNameImageServicePointOfInterestY]: coordinate.y,
                    [ColNameImageServicePointOfInterestDescription]: description,
                })
                .returning(ColNameImageServicePointOfInterestId)
                .into(TabNameImageServicePointOfInterest);
            const id = +rows[0][ColNameImageServicePointOfInterestId];
            return new PointOfInterest(
                id,
                ofImageId,
                createdByUserId,
                currentTime,
                currentTime,
                coordinate,
                description
            );
        } catch (error) {
            this.logger.error("failed to create point of interest", {
                ofImageId,
                createdByUserId,
                coordinate,
                description,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getPointOfInterestListOfImage(imageId: number): Promise<PointOfInterest[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServicePointOfInterest)
                .where(ColNameImageServicePointOfInterestOfImageId, "=", imageId);
            return rows.map((row) => this.getPointOfInterestFromRow(row));
        } catch (error) {
            this.logger.error("failed to get point of interest list of image", { imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getPointOfInterestListOfImageList(imageIdList: number[]): Promise<PointOfInterest[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServicePointOfInterest)
                .whereIn(ColNameImageServicePointOfInterestOfImageId, imageIdList);

            const imageIdToRegionList = new Map<number, PointOfInterest[]>();
            for (const row of rows) {
                const imageId = +row[ColNameImageServicePointOfInterestOfImageId];
                if (!imageIdToRegionList.has(imageId)) {
                    imageIdToRegionList.set(imageId, []);
                }
                imageIdToRegionList.get(imageId)?.push(this.getPointOfInterestFromRow(row));
            }

            const results: PointOfInterest[][] = [];
            for (const imageId of imageIdList) {
                results.push(imageIdToRegionList.get(imageId) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get point of interest list of image list", {
                imageId: imageIdList,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getPointOfInterestWithXLock(id: number): Promise<PointOfInterest | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServicePointOfInterest)
                .where({
                    [ColNameImageServicePointOfInterestId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get point of interest", {
                pointOfInterestId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no point of interest with id found", { id });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one point of interest with id found", {
                id,
            });
            throw new ErrorWithStatus(`more than point of interest with id ${id} found`, status.INTERNAL);
        }
        return this.getPointOfInterestFromRow(rows[0]);
    }

    public async updatePointOfInterest(poi: PointOfInterest): Promise<PointOfInterest> {
        const currentTime = this.timer.getCurrentTime();
        try {
            const rows = await this.knex
                .table(TabNameImageServicePointOfInterest)
                .update({
                    [ColNameImageServicePointOfInterestUpdatedTime]: currentTime,
                    [ColNameImageServicePointOfInterestX]: poi.coordinate.x,
                    [ColNameImageServicePointOfInterestY]: poi.coordinate.y,
                    [ColNameImageServicePointOfInterestDescription]: poi.description,
                })
                .where({ [ColNameImageServicePointOfInterestId]: poi.id })
                .returning("*");

            if (rows.length === 0) {
                this.logger.info("no point of interest with id found", { pointOfInterestId: poi.id });
                throw new ErrorWithStatus(`more than point of interest with id ${poi.id} found`, status.NOT_FOUND);
            }

            if (rows.length > 1) {
                this.logger.error("more than one point of interest with id found", {
                    pointOfInterestId: poi.id,
                });
                throw new ErrorWithStatus(`more than point of interest with id ${poi.id} found`, status.INTERNAL);
            }

            return this.getPointOfInterestFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to update point of interest", { poi, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deletePointOfInterest(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServicePointOfInterest)
                .where({
                    [ColNameImageServicePointOfInterestId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete point of interest", {
                regionId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no point of interest with id found", { pointOfInterestId: id });
            throw new ErrorWithStatus(`no point of interest with id ${id} found`, status.NOT_FOUND);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: PointOfInterestDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new PointOfInterestDataAccessorImpl(tx, this.logger, this.timer);
            return executeFunc(txDataAccessor);
        });
    }

    private getPointOfInterestFromRow(row: Record<string, any>): PointOfInterest {
        return new PointOfInterest(
            +row[ColNameImageServicePointOfInterestId],
            +row[ColNameImageServicePointOfInterestOfImageId],
            +row[ColNameImageServicePointOfInterestCreatedByUserId],
            +row[ColNameImageServicePointOfInterestCreatedTime],
            +row[ColNameImageServicePointOfInterestUpdatedTime],
            {
                x: +row[ColNameImageServicePointOfInterestX],
                y: +row[ColNameImageServicePointOfInterestY],
            },
            row[ColNameImageServicePointOfInterestDescription]
        );
    }
}

injected(PointOfInterestDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN, TIMER_TOKEN);

export const POINT_OF_INTEREST_DATA_ACCESSOR_TOKEN = token<PointOfInterestDataAccessor>("PointOfInterestDataAccessor");
