import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTag } from "./models";

export interface ImageHasImageTagDataAccessor {
    createImageHasImageTag(imageID: number, imageTagID: number): Promise<void>;
    deleteImageHasImageTag(imageID: number, imageTagID: number): Promise<void>;
    deleteImageHasImageTagOfImage(imageID: number): Promise<void>;
    getImageTagListOfImageList(imageIDList: number[]): Promise<ImageTag[][]>;
    getImageIDListOfImageTagList(imageTagIDList: number[]): Promise<number[]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: ImageHasImageTagDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImageHasImageTag =
    "image_service_image_has_image_tag_tab";
const ColNameImageServiceImageHasImageTagImageID = "image_id";
const ColNameImageServiceImageHasImageTagImageTagID = "image_tag_id";

const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const ColNameImageServiceImageTagID = "id";
const ColNameImageServiceImageTagOfImageTagGroupID = "of_image_tag_group_id";
const ColNameImageServiceImageTagDisplayName = "display_name";
export class ImageHasImageTagDataAccessorImpl
    implements ImageHasImageTagDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImageHasImageTag(
        imageID: number,
        imageTagID: number
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceImageHasImageTagImageID]: imageID,
                    [ColNameImageServiceImageHasImageTagImageTagID]: imageTagID,
                })
                .into(TabNameImageServiceImageHasImageTag);
        } catch (error) {
            this.logger.error(
                "failed to create new image has image tag relation",
                { imageID, imageTagID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageHasImageTag(
        imageID: number,
        imageTagID: number
    ): Promise<void> {
        let deleteCount: number;
        try {
            deleteCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageHasImageTag)
                .where({
                    [ColNameImageServiceImageHasImageTagImageID]: imageID,
                    [ColNameImageServiceImageHasImageTagImageTagID]: imageTagID,
                });
        } catch (error) {
            this.logger.error("failed to delete image has image tag relation", {
                imageID,
                imageTagID,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deleteCount === 0) {
            this.logger.error("no image has image tag relation found", {
                imageID,
                imageTagID,
            });
            throw new ErrorWithStatus(
                `no image has image relation found with image_id ${imageID} and image_tag_id ${imageTagID}`,
                status.NOT_FOUND
            );
        }
    }

    public async deleteImageHasImageTagOfImage(imageID: number): Promise<void> {
        let deleteCount: number;
        try {
            deleteCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageHasImageTag)
                .where({
                    [ColNameImageServiceImageHasImageTagImageID]: imageID,
                });
        } catch (error) {
            this.logger.error(
                "failed to delete image has image tag relation of image list",
                { error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagListOfImageList(
        imageIDList: number[]
    ): Promise<ImageTag[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageHasImageTag)
                .join(
                    TabNameImageServiceImageTag,
                    ColNameImageServiceImageHasImageTagImageTagID,
                    ColNameImageServiceImageTagID
                )
                .whereIn(
                    ColNameImageServiceImageHasImageTagImageID,
                    imageIDList
                );

            const imageIDToImageTagList = new Map<number, ImageTag[]>();
            for (const row of rows) {
                const imageID =
                    +row[ColNameImageServiceImageHasImageTagImageID];
                if (!imageIDToImageTagList.has(imageID)) {
                    imageIDToImageTagList.set(imageID, []);
                }
                imageIDToImageTagList
                    .get(imageID)
                    ?.push(
                        new ImageTag(
                            +row[ColNameImageServiceImageHasImageTagImageTagID],
                            +row[ColNameImageServiceImageTagOfImageTagGroupID],
                            row[ColNameImageServiceImageTagDisplayName]
                        )
                    );
            }

            const results: ImageTag[][] = [];
            for (const imageID of imageIDList) {
                results.push(imageIDToImageTagList.get(imageID) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get image tag list of image list", {
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageIDListOfImageTagList(
        imageTagIDList: number[]
    ): Promise<number[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageHasImageTag)
                .whereIn(
                    ColNameImageServiceImageHasImageTagImageTagID,
                    imageTagIDList
                );
            return rows.map(
                (row) => +row[ColNameImageServiceImageHasImageTagImageID]
            );
        } catch (error) {
            this.logger.error("failed to get image id list of image tag list", {
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: ImageHasImageTagDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageHasImageTagDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }
}

injected(ImageHasImageTagDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN =
    token<ImageHasImageTagDataAccessor>("ImageHasImageTagDataAccessor");
