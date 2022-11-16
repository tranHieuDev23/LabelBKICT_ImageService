import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTagGroup } from "./models";

export interface ImageTagGroupDataAccessor {
    createImageTagGroup(displayName: string, isSingleValue: boolean): Promise<number>;
    getImageTagGroupList(): Promise<ImageTagGroup[]>;
    getImageTagGroup(id: number): Promise<ImageTagGroup | null>;
    getImageTagGroupListWithIdList(idList: number[]): Promise<(ImageTagGroup | null)[]>;
    getImageTagGroupWithXLock(id: number): Promise<ImageTagGroup | null>;
    updateImageTagGroup(imageTagGroup: ImageTagGroup): Promise<void>;
    deleteImageTagGroup(id: number): Promise<void>;
    withTransaction<T>(executeFunc: (dataAccessor: ImageTagGroupDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceImageTagGroup = "image_service_image_tag_group_tab";
const ColNameImageServiceImageTagGroupId = "image_tag_group_id";
const ColNameImageServiceImageTagGroupDisplayName = "display_name";
const ColNameImageServiceImageTagGroupIsSingleValue = "is_single_value";

export class ImageTagGroupDataAccessorImpl implements ImageTagGroupDataAccessor {
    constructor(private readonly knex: Knex<any, any[]>, private readonly logger: Logger) {}

    public async createImageTagGroup(displayName: string, isSingleValue: boolean): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageTagGroupDisplayName]: displayName,
                    [ColNameImageServiceImageTagGroupIsSingleValue]: isSingleValue,
                })
                .returning(ColNameImageServiceImageTagGroupId)
                .into(TabNameImageServiceImageTagGroup);
            return +rows[0][ColNameImageServiceImageTagGroupId];
        } catch (error) {
            this.logger.error("failed to create image tag group", {
                displayName,
                isSingleValue,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagGroupList(): Promise<ImageTagGroup[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroup)
                .orderBy(ColNameImageServiceImageTagGroupId, "asc");
            return rows.map((row) => this.getImageTagGroupFromRow(row));
        } catch (error) {
            this.logger.error("failed to get image tag group list", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagGroup(id: number): Promise<ImageTagGroup | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroup)
                .where({
                    [ColNameImageServiceImageTagGroupId]: id,
                });
        } catch (error) {
            this.logger.error("failed to get image tag group", {
                imageTagGroupId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag group with image_tag_group_id found", { imageTagGroupId: id });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one image tag group with image_tag_group_id found", { imageTagGroupId: id });
            throw new ErrorWithStatus("more than one image tag group was found", status.INTERNAL);
        }
        return this.getImageTagGroupFromRow(rows[0]);
    }

    public async getImageTagGroupListWithIdList(idList: number[]): Promise<(ImageTagGroup | null)[]> {
        return Promise.all(idList.map((id) => this.getImageTagGroup(id)));
    }

    public async getImageTagGroupWithXLock(id: number): Promise<ImageTagGroup | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroup)
                .where({
                    [ColNameImageServiceImageTagGroupId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get image tag group", {
                imageTagGroupId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag group with image_tag_group_id found", { imageTagGroupId: id });
            return null;
        }
        if (rows.length > 1) {
            this.logger.error("more than one image tag group with image_tag_group_id found", { imageTagGroupId: id });
            throw new ErrorWithStatus("more than one image tag group was found", status.INTERNAL);
        }
        return this.getImageTagGroupFromRow(rows[0]);
    }

    public async updateImageTagGroup(imageTagGroup: ImageTagGroup): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImageTagGroup)
                .update({
                    [ColNameImageServiceImageTagGroupDisplayName]: imageTagGroup.displayName,
                    [ColNameImageServiceImageTagGroupIsSingleValue]: imageTagGroup.isSingleValue,
                })
                .where({
                    [ColNameImageServiceImageTagGroupId]: imageTagGroup.id,
                });
        } catch (error) {
            this.logger.error("failed to update image tag group", {
                imageType: imageTagGroup,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageTagGroup(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageTagGroup)
                .where({
                    [ColNameImageServiceImageTagGroupId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image tag group", {
                imageTypeId: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId: id });
            throw new ErrorWithStatus(`no image tag group with image_tag_group_id ${id} found`, status.NOT_FOUND);
        }
    }

    public async withTransaction<T>(executeFunc: (dataAccessor: ImageTagGroupDataAccessor) => Promise<T>): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageTagGroupDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private getImageTagGroupFromRow(row: Record<string, any>): ImageTagGroup {
        return new ImageTagGroup(
            +row[ColNameImageServiceImageTagGroupId],
            row[ColNameImageServiceImageTagGroupDisplayName],
            row[ColNameImageServiceImageTagGroupIsSingleValue]
        );
    }
}

injected(ImageTagGroupDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN = token<ImageTagGroupDataAccessor>("ImageTagGroupDataAccessor");
