import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class ImageTagGroup {
    constructor(
        public id: number,
        public displayName: string,
        public isSingleValue: boolean
    ) {}
}

export interface ImageTagGroupDataAccessor {
    createImageTagGroup(
        displayName: string,
        isSingleValue: boolean
    ): Promise<number>;
    getImageTagGroupList(): Promise<ImageTagGroup[]>;
    updateImageTagGroup(imageTagGroup: ImageTagGroup): Promise<void>;
    deleteImageTagGroup(id: number): Promise<void>;
}

const TabNameImageServiceImageTagGroup = "image_service_image_tag_group";
const ColNameImageServiceImageTagGroupID = "id";
const ColNameImageServiceImageTagGroupDisplayName = "display_name";
const ColNameImageServiceImageTagGroupIsSingleValue = "is_single_value";

export class ImageTagGroupDataAccessorImpl
    implements ImageTagGroupDataAccessor
{
    constructor(private readonly knex: Knex, private readonly logger: Logger) {}

    public async createImageTagGroup(
        displayName: string,
        isSingleValue: boolean
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageTagGroupDisplayName]: displayName,
                    [ColNameImageServiceImageTagGroupIsSingleValue]:
                        isSingleValue,
                })
                .returning(ColNameImageServiceImageTagGroupID)
                .into(TabNameImageServiceImageTagGroup);
            return +rows[0][ColNameImageServiceImageTagGroupID];
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
                .from(TabNameImageServiceImageTagGroup);
            return rows.map((row) => this.getImageTagGroupFromRow(row));
        } catch (error) {
            this.logger.error("failed to get image tag group list", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateImageTagGroup(
        imageTagGroup: ImageTagGroup
    ): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImageTagGroup)
                .update({
                    [ColNameImageServiceImageTagGroupDisplayName]:
                        imageTagGroup.displayName,
                    [ColNameImageServiceImageTagGroupIsSingleValue]:
                        imageTagGroup.isSingleValue,
                })
                .where({
                    [ColNameImageServiceImageTagGroupID]: imageTagGroup.id,
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
                    [ColNameImageServiceImageTagGroupID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image tag group", {
                imageTypeID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupID: id }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    private getImageTagGroupFromRow(row: Record<string, any>): ImageTagGroup {
        return new ImageTagGroup(
            +row[ColNameImageServiceImageTagGroupID],
            row[ColNameImageServiceImageTagGroupDisplayName],
            row[ColNameImageServiceImageTagGroupIsSingleValue]
        );
    }
}

injected(ImageTagGroupDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN =
    token<ImageTagGroupDataAccessor>("ImageTagGroupDataAccessor");
