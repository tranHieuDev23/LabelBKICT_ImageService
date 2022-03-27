import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTagGroup, ImageType } from "./models";

export interface ImageTagGroupHasImageTypeDataAccessor {
    createImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void>;
    deleteImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void>;
    getImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<{
        imageTagGroupId: number;
        imageTypeId: number;
    } | null>;
    getImageTagGroupHasImageTypeWithXLock(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<{
        imageTagGroupId: number;
        imageTypeId: number;
    } | null>;
    getImageTypeListOfImageTagGroupList(
        imageTagGroupIdList: number[]
    ): Promise<ImageType[][]>;
    getImageTagGroupOfImageType(imageTypeId: number): Promise<ImageTagGroup[]>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: ImageTagGroupHasImageTypeDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImageTagGroupHasImageType =
    "image_service_image_tag_group_has_image_type_tab";
const ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId =
    "image_tag_group_id";
const ColNameImageServiceImageTagGroupHasImageTypeImageTypeId = "image_type_id";

const TabNameImageServiceImageType = "image_service_image_type_tab";
const ColNameImageServiceImageTypeId = "image_type_id";
const ColNameImageServiceImageTypeDisplayName = "display_name";
const ColNameImageServiceImageTypeHasPredictiveModel = "has_predictive_model";

const TabNameImageServiceImageTagGroup = "image_service_image_tag_group_tab";
const ColNameImageServiceImageTagGroupId = "image_tag_group_id";
const ColNameImageServiceImageTagGroupDisplayName = "display_name";
const ColNameImageServiceImageTagGroupIsSingleValue = "is_single_value";
export class ImageTagGroupHasImageTypeDataAccessorImpl
    implements ImageTagGroupHasImageTypeDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId]:
                        imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeId]:
                        imageTypeId,
                })
                .into(TabNameImageServiceImageTagGroupHasImageType);
        } catch (error) {
            this.logger.error(
                "failed to create image type has image tag group relation",
                { imageTagGroupId, imageTypeId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId]:
                        imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeId]:
                        imageTypeId,
                });
        } catch (error) {
            this.logger.error(
                "failed to delete image type has image tag group relation",
                { imageTagGroupId, imageTypeId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.debug(
                "no image type has user image tag group relation found",
                { imageTagGroupId, imageTypeId }
            );
            throw new ErrorWithStatus(
                `no image type has image tag group relation found with image_type_id ${imageTypeId}, image_tag_group_id ${imageTagGroupId}`,
                status.NOT_FOUND
            );
        }
    }

    public async getImageTagGroupHasImageType(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<{ imageTagGroupId: number; imageTypeId: number } | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId]:
                        imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeId]:
                        imageTypeId,
                });
        } catch (error) {
            this.logger.error(
                "failed to get image tag group has image type relation",
                { imageTagGroupId, imageTypeId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info(
                "no image tag group has image type relation found found",
                { imageTagGroupId, imageTypeId }
            );
            return null;
        }
        if (rows.length > 1) {
            this.logger.info(
                "more than one image tag group has image type relation found found",
                { imageTagGroupId, imageTypeId }
            );
            throw new ErrorWithStatus(
                "more than one relation was found",
                status.INTERNAL
            );
        }
        return { imageTagGroupId, imageTypeId };
    }

    public async getImageTagGroupHasImageTypeWithXLock(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<{ imageTagGroupId: number; imageTypeId: number } | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId]:
                        imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeId]:
                        imageTypeId,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error(
                "failed to get image tag group has image type relation",
                { imageTagGroupId, imageTypeId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info(
                "no image tag group has image type relation found found",
                { imageTagGroupId, imageTypeId }
            );
            return null;
        }
        if (rows.length > 1) {
            this.logger.info(
                "more than one image tag group has image type relation found found",
                { imageTagGroupId, imageTypeId }
            );
            throw new ErrorWithStatus(
                "more than one relation was found",
                status.INTERNAL
            );
        }
        return { imageTagGroupId, imageTypeId };
    }

    public async getImageTypeListOfImageTagGroupList(
        imageTagGroupIdList: number[]
    ): Promise<ImageType[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .join(
                    TabNameImageServiceImageType,
                    `${TabNameImageServiceImageTagGroupHasImageType}.${ColNameImageServiceImageTagGroupHasImageTypeImageTypeId}`,
                    `${TabNameImageServiceImageType}.${ColNameImageServiceImageTypeId}`
                )
                .whereIn(
                    ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId,
                    imageTagGroupIdList
                )
                .orderBy(
                    ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId,
                    "asc"
                );

            const imageTagGroupIdToImageTypeList = new Map<
                number,
                ImageType[]
            >();
            for (const row of rows) {
                const imageTagGroupId =
                    +row[
                        ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId
                    ];
                if (!imageTagGroupIdToImageTypeList.has(imageTagGroupId)) {
                    imageTagGroupIdToImageTypeList.set(imageTagGroupId, []);
                }
                imageTagGroupIdToImageTypeList
                    .get(imageTagGroupId)
                    ?.push(
                        new ImageType(
                            +row[
                                ColNameImageServiceImageTagGroupHasImageTypeImageTypeId
                            ],
                            row[ColNameImageServiceImageTypeDisplayName],
                            row[ColNameImageServiceImageTypeHasPredictiveModel]
                        )
                    );
            }

            const results: ImageType[][] = [];
            for (const imageTagGroupId of imageTagGroupIdList) {
                results.push(
                    imageTagGroupIdToImageTypeList.get(imageTagGroupId) || []
                );
            }

            return results;
        } catch (error) {
            this.logger.error(
                "failed to get image type list of image tag group id list",
                { error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTagGroupOfImageType(
        imageTypeId: number
    ): Promise<ImageTagGroup[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .join(
                    TabNameImageServiceImageTagGroup,
                    `${TabNameImageServiceImageTagGroupHasImageType}.${ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId}`,
                    `${TabNameImageServiceImageTagGroup}.${ColNameImageServiceImageTagGroupId}`
                )
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeId]:
                        imageTypeId,
                });

            return rows.map(
                (row) =>
                    new ImageTagGroup(
                        +row[
                            ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupId
                        ],
                        row[ColNameImageServiceImageTagGroupDisplayName],
                        row[ColNameImageServiceImageTagGroupIsSingleValue]
                    )
            );
        } catch (error) {
            this.logger.error(
                "failed to get image tag group list of image type id",
                { imageTypeId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (
            dataAccessor: ImageTagGroupHasImageTypeDataAccessor
        ) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor =
                new ImageTagGroupHasImageTypeDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }
}

injected(
    ImageTagGroupHasImageTypeDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN =
    token<ImageTagGroupHasImageTypeDataAccessor>(
        "ImageTagGroupHasImageTypeDataAccessor"
    );
