import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTag } from "./models";

export interface ImageTagDataAccessor {
    createImageTag(
        ofImageTagGroupID: number,
        displayName: string
    ): Promise<number>;
    getImageTagListOfImageTagGroupIDList(
        imageTagGroupIDList: number[]
    ): Promise<ImageTag[][]>;
    getImageTag(id: number): Promise<ImageTag | null>;
    getImageTagWithXLock(id: number): Promise<ImageTag | null>;
    updateImageTag(imageTag: ImageTag): Promise<void>;
    deleteImageTag(id: number): Promise<void>;
    withTransaction<T>(
        executeFunc: (dataAccessor: ImageTagDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const ColNameImageServiceImageTagID = "image_tag_id";
const ColNameImageServiceImageTagOfImageTagGroupID = "of_image_tag_group_id";
const ColNameImageServiceImageTagDisplayName = "display_name";

export class ImageTagDataAccessorImpl implements ImageTagDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImageTag(
        ofImageTypeID: number,
        displayName: string
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageTagOfImageTagGroupID]:
                        ofImageTypeID,
                    [ColNameImageServiceImageTagDisplayName]: displayName,
                })
                .returning(ColNameImageServiceImageTagID)
                .into(TabNameImageServiceImageTag);
            return +rows[0][ColNameImageServiceImageTagID];
        } catch (error) {
            this.logger.error("failed to create image tag", {
                displayName,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagListOfImageTagGroupIDList(
        imageTagGroupIDList: number[]
    ): Promise<ImageTag[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag)
                .whereIn(
                    ColNameImageServiceImageTagOfImageTagGroupID,
                    imageTagGroupIDList
                );

            const imageTagGroupIDToImageTagList = new Map<number, ImageTag[]>();
            for (const row of rows) {
                const imageTagGroupID =
                    +row[ColNameImageServiceImageTagOfImageTagGroupID];
                if (!imageTagGroupIDToImageTagList.has(imageTagGroupID)) {
                    imageTagGroupIDToImageTagList.set(imageTagGroupID, []);
                }
                imageTagGroupIDToImageTagList
                    .get(imageTagGroupID)
                    ?.push(this.getImageTagFromRow(row));
            }

            const results: ImageTag[][] = [];
            for (const imageTagGroupID of imageTagGroupIDList) {
                results.push(
                    imageTagGroupIDToImageTagList.get(imageTagGroupID) || []
                );
            }
            return results;
        } catch (error) {
            this.logger.error(
                "failed to get image tag list of image tag group id list",
                { error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTag(id: number): Promise<ImageTag | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag)
                .where({
                    [ColNameImageServiceImageTagID]: id,
                });
        } catch (error) {
            this.logger.error("failed to get image tag", {
                imageTagID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag with image_tag_id found", {
                imageTagID: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error(
                "more than one image tag with image_tag_id found",
                { imageTagID: id }
            );
            throw new ErrorWithStatus(
                "more than one image tag was found",
                status.INTERNAL
            );
        }
        return this.getImageTagFromRow(rows[0]);
    }

    public async getImageTagWithXLock(id: number): Promise<ImageTag | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag)
                .where({
                    [ColNameImageServiceImageTagID]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get image tag", {
                imageTagID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag with image_tag_id found", {
                imageTagID: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error(
                "more than one image tag with image_tag_id found",
                { imageTagID: id }
            );
            throw new ErrorWithStatus(
                "more than one image tag was found",
                status.INTERNAL
            );
        }
        return this.getImageTagFromRow(rows[0]);
    }

    public async updateImageTag(regionLabel: ImageTag): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImageTag)
                .update({
                    [ColNameImageServiceImageTagOfImageTagGroupID]:
                        regionLabel.ofImageTagGroupID,
                    [ColNameImageServiceImageTagDisplayName]:
                        regionLabel.displayName,
                })
                .where({
                    [ColNameImageServiceImageTagID]: regionLabel.id,
                });
        } catch (error) {
            this.logger.error("failed to update image tag", {
                imageType: regionLabel,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageTag(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageTag)
                .where({
                    [ColNameImageServiceImageTagID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image tag", {
                imageTagID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image tag with image_tag_id found", {
                imageTagID: id,
            });
            throw new ErrorWithStatus(
                `no image tag with image_tag_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: ImageTagDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageTagDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getImageTagFromRow(row: Record<string, any>): ImageTag {
        return new ImageTag(
            +row[ColNameImageServiceImageTagID],
            +row[ColNameImageServiceImageTagOfImageTagGroupID],
            row[ColNameImageServiceImageTagDisplayName]
        );
    }
}

injected(ImageTagDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_TAG_DATA_ACCESSOR_TOKEN = token<ImageTagDataAccessor>(
    "ImageTagDataAccessor"
);
