import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTag } from "./models";

export interface ImageHasImageTagDataAccessor {
    createImageHasImageTag(imageId: number, imageTagId: number): Promise<void>;
    deleteImageHasImageTag(imageId: number, imageTagId: number): Promise<void>;
    deleteImageHasImageTagOfImage(imageId: number): Promise<void>;
    getImageTagListOfImageList(imageIdList: number[]): Promise<ImageTag[][]>;
    getImageIdListOfImageTagList(imageTagIdList: number[]): Promise<number[][]>;
    withTransaction<T>(
        executeFunc: (dataAccessor: ImageHasImageTagDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImageHasImageTag =
    "image_service_image_has_image_tag_tab";
const ColNameImageServiceImageHasImageTagImageId = "image_id";
const ColNameImageServiceImageHasImageTagImageTagId = "image_tag_id";

const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const ColNameImageServiceImageTagId = "image_tag_id";
const ColNameImageServiceImageTagOfImageTagGroupId = "of_image_tag_group_id";
const ColNameImageServiceImageTagDisplayName = "display_name";
export class ImageHasImageTagDataAccessorImpl
    implements ImageHasImageTagDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImageHasImageTag(
        imageId: number,
        imageTagId: number
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceImageHasImageTagImageId]: imageId,
                    [ColNameImageServiceImageHasImageTagImageTagId]: imageTagId,
                })
                .into(TabNameImageServiceImageHasImageTag);
        } catch (error) {
            this.logger.error(
                "failed to create new image has image tag relation",
                { imageId, imageTagId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageHasImageTag(
        imageId: number,
        imageTagId: number
    ): Promise<void> {
        let deleteCount: number;
        try {
            deleteCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageHasImageTag)
                .where({
                    [ColNameImageServiceImageHasImageTagImageId]: imageId,
                    [ColNameImageServiceImageHasImageTagImageTagId]: imageTagId,
                });
        } catch (error) {
            this.logger.error("failed to delete image has image tag relation", {
                imageId,
                imageTagId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deleteCount === 0) {
            this.logger.error("no image has image tag relation found", {
                imageId,
                imageTagId,
            });
            throw new ErrorWithStatus(
                `no image has image relation found with image_id ${imageId} and image_tag_id ${imageTagId}`,
                status.NOT_FOUND
            );
        }
    }

    public async deleteImageHasImageTagOfImage(imageId: number): Promise<void> {
        try {
            await this.knex
                .delete()
                .from(TabNameImageServiceImageHasImageTag)
                .where({
                    [ColNameImageServiceImageHasImageTagImageId]: imageId,
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
        imageIdList: number[]
    ): Promise<ImageTag[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageHasImageTag)
                .join(
                    TabNameImageServiceImageTag,
                    `${TabNameImageServiceImageHasImageTag}.${ColNameImageServiceImageHasImageTagImageTagId}`,
                    `${TabNameImageServiceImageTag}.${ColNameImageServiceImageTagId}`
                )
                .whereIn(
                    ColNameImageServiceImageHasImageTagImageId,
                    imageIdList
                );

            const imageIdToImageTagList = new Map<number, ImageTag[]>();
            for (const row of rows) {
                const imageId =
                    +row[ColNameImageServiceImageHasImageTagImageId];
                if (!imageIdToImageTagList.has(imageId)) {
                    imageIdToImageTagList.set(imageId, []);
                }
                imageIdToImageTagList
                    .get(imageId)
                    ?.push(
                        new ImageTag(
                            +row[ColNameImageServiceImageHasImageTagImageTagId],
                            +row[ColNameImageServiceImageTagOfImageTagGroupId],
                            row[ColNameImageServiceImageTagDisplayName]
                        )
                    );
            }

            const results: ImageTag[][] = [];
            for (const imageId of imageIdList) {
                results.push(imageIdToImageTagList.get(imageId) || []);
            }
            return results;
        } catch (error) {
            this.logger.error("failed to get image tag list of image list", {
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageIdListOfImageTagList(
        imageTagIdList: number[]
    ): Promise<number[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageHasImageTag)
                .whereIn(
                    ColNameImageServiceImageHasImageTagImageTagId,
                    imageTagIdList
                );

            const imageTagIdToImageIdList = new Map<number, number[]>();
            for (const row of rows) {
                const imageTagId =
                    +row[ColNameImageServiceImageHasImageTagImageTagId];
                if (!imageTagIdToImageIdList.has(imageTagId)) {
                    imageTagIdToImageIdList.set(imageTagId, []);
                }
                imageTagIdToImageIdList
                    .get(imageTagId)
                    ?.push(+row[ColNameImageServiceImageHasImageTagImageId]);
            }

            const results: number[][] = [];
            for (const imageTagId of imageTagIdList) {
                results.push(imageTagIdToImageIdList.get(imageTagId) || []);
            }
            return results;
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
