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
    getImageTagList(): Promise<ImageTag[]>;
    updateImageTag(regionLabel: ImageTag): Promise<void>;
    deleteImageTag(id: number): Promise<void>;
}

const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const ColNameImageServiceImageTagID = "id";
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

    public async getImageTagList(): Promise<ImageTag[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTag);
            return rows.map((row) => this.getImageTagFromRow(row));
        } catch (error) {
            this.logger.error("failed to get image tag list", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
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
