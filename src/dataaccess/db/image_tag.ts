import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTag } from "./models";

export interface ImageTagDataAccessor {
    createImageTag(ofImageTagGroupId: number, displayName: string): Promise<number>;
    getImageTagListOfImageTagGroupIdList(imageTagGroupIdList: number[]): Promise<ImageTag[][]>;
    getImageTag(id: number): Promise<ImageTag | null>;
    getImageTagWithIdList(idList: number[]): Promise<(ImageTag | null)[]>;
    getImageTagWithXLock(id: number): Promise<ImageTag | null>;
    updateImageTag(imageTag: ImageTag): Promise<void>;
    deleteImageTag(id: number): Promise<void>;
    withTransaction<T>(executeFunc: (dataAccessor: ImageTagDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const ColNameImageServiceImageTagId = "image_tag_id";
const ColNameImageServiceImageTagOfImageTagGroupId = "of_image_tag_group_id";
const ColNameImageServiceImageTagDisplayName = "display_name";

export class ImageTagDataAccessorImpl implements ImageTagDataAccessor {
    constructor(private readonly knex: Knex<any, any[]>, private readonly logger: Logger) {}

    public async createImageTag(ofImageTypeId: number, displayName: string): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageTagOfImageTagGroupId]: ofImageTypeId,
                    [ColNameImageServiceImageTagDisplayName]: displayName,
                })
                .returning(ColNameImageServiceImageTagId)
                .into(TabNameImageServiceImageTag);
            return +rows[0][ColNameImageServiceImageTagId];
        } catch (error) {
            this.logger.error("failed to create image tag", {
                displayName,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagListOfImageTagGroupIdList(imageTagGroupIdList: number[]): Promise<ImageTag[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag)
                .whereIn(ColNameImageServiceImageTagOfImageTagGroupId, imageTagGroupIdList);

            const imageTagGroupIdToImageTagList = new Map<number, ImageTag[]>();
            for (const row of rows) {
                const imageTagGroupId = +row[ColNameImageServiceImageTagOfImageTagGroupId];
                if (!imageTagGroupIdToImageTagList.has(imageTagGroupId)) {
                    imageTagGroupIdToImageTagList.set(imageTagGroupId, []);
                }
                imageTagGroupIdToImageTagList.get(imageTagGroupId)?.push(this.getImageTagFromRow(row));
            }

            const results: ImageTag[][] = [];
            for (const imageTagGroupId of imageTagGroupIdList) {
                results.push(imageTagGroupIdToImageTagList.get(imageTagGroupId) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get image tag list of image tag group id list", { error });
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
                    [ColNameImageServiceImageTagId]: id,
                });
        } catch (error) {
            this.logger.error("failed to get image tag", {
                imageTagId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag with image_tag_id found", {
                imageTagId: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one image tag with image_tag_id found", { imageTagId: id });
            throw new ErrorWithStatus("more than one image tag was found", status.INTERNAL);
        }
        return this.getImageTagFromRow(rows[0]);
    }

    public async getImageTagWithIdList(idList: number[]): Promise<(ImageTag | null)[]> {
        return Promise.all(idList.map((id) => this.getImageTag(id)));
    }

    public async getImageTagWithXLock(id: number): Promise<ImageTag | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag)
                .where({
                    [ColNameImageServiceImageTagId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get image tag", {
                imageTagId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag with image_tag_id found", {
                imageTagId: id,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one image tag with image_tag_id found", { imageTagId: id });
            throw new ErrorWithStatus("more than one image tag was found", status.INTERNAL);
        }
        return this.getImageTagFromRow(rows[0]);
    }

    public async updateImageTag(regionLabel: ImageTag): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImageTag)
                .update({
                    [ColNameImageServiceImageTagOfImageTagGroupId]: regionLabel.ofImageTagGroupId,
                    [ColNameImageServiceImageTagDisplayName]: regionLabel.displayName,
                })
                .where({
                    [ColNameImageServiceImageTagId]: regionLabel.id,
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
                    [ColNameImageServiceImageTagId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image tag", {
                imageTagId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image tag with image_tag_id found", {
                imageTagId: id,
            });
            throw new ErrorWithStatus(`no image tag with image_tag_id ${id} found`, status.NOT_FOUND);
        }
    }

    public async withTransaction<T>(executeFunc: (dataAccessor: ImageTagDataAccessor) => Promise<T>): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageTagDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private getImageTagFromRow(row: Record<string, any>): ImageTag {
        return new ImageTag(
            +row[ColNameImageServiceImageTagId],
            +row[ColNameImageServiceImageTagOfImageTagGroupId],
            row[ColNameImageServiceImageTagDisplayName]
        );
    }
}

injected(ImageTagDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_TAG_DATA_ACCESSOR_TOKEN = token<ImageTagDataAccessor>("ImageTagDataAccessor");
