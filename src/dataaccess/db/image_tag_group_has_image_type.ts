import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageTagGroup, ImageType } from "./models";

export interface ImageTagGroupHasImageTypeDataAccessor {
    createImageTagGroupHasImageType(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void>;
    deleteImageTagGroupHasImageType(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void>;
    getImageTagGroupHasImageType(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<{
        imageTagGroupID: number;
        imageTypeID: number;
    } | null>;
    getImageTagGroupHasImageTypeWithXLock(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<{
        imageTagGroupID: number;
        imageTypeID: number;
    } | null>;
    getImageTypeListOfImageTagGroupList(
        imageTagGroupIDList: number[]
    ): Promise<ImageType[][]>;
    getImageTagGroupOfImageType(imageTypeID: number): Promise<ImageTagGroup[]>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: ImageTagGroupHasImageTypeDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImageTagGroupHasImageType =
    "image_service_image_tag_group_has_image_type_tab";
const ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID =
    "image_tag_group_id";
const ColNameImageServiceImageTagGroupHasImageTypeImageTypeID = "image_type_id";

const TabNameImageServiceImageType = "image_service_image_type_tab";
const ColNameImageServiceImageTypeID = "id";
const ColNameImageServiceImageTypeDisplayName = "display_name";
const ColNameImageServiceImageTypeHasPredictiveModel = "has_predictive_model";

const TabNameImageServiceImageTagGroup = "image_service_image_tag_group";
const ColNameImageServiceImageTagGroupID = "id";
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
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID]:
                        imageTagGroupID,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeID]:
                        imageTypeID,
                })
                .into(TabNameImageServiceImageTagGroupHasImageType);
        } catch (error) {
            this.logger.error(
                "failed to create image type has image tag group relation",
                { imageTagGroupID, imageTypeID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageTagGroupHasImageType(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID]:
                        imageTagGroupID,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeID]:
                        imageTypeID,
                });
        } catch (error) {
            this.logger.error(
                "failed to delete image type has image tag group relation",
                { imageTagGroupID, imageTypeID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.debug(
                "no image type has user image tag group relation found",
                { imageTagGroupID, imageTypeID }
            );
            throw new ErrorWithStatus(
                `no image type has image tag group relation found with image_type_id ${imageTypeID}, image_tag_group_id ${imageTagGroupID}`,
                status.NOT_FOUND
            );
        }
    }

    public async getImageTagGroupHasImageType(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<{ imageTagGroupID: number; imageTypeID: number } | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID]:
                        imageTagGroupID,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeID]:
                        imageTypeID,
                });
        } catch (error) {
            this.logger.error(
                "failed to get image tag group has image type relation",
                { imageTagGroupID, imageTypeID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info(
                "no image tag group has image type relation found found",
                { imageTagGroupID, imageTypeID }
            );
            return null;
        }
        if (rows.length > 1) {
            this.logger.info(
                "more than one image tag group has image type relation found found",
                { imageTagGroupID, imageTypeID }
            );
            throw new ErrorWithStatus(
                "more than one relation was found",
                status.INTERNAL
            );
        }
        return { imageTagGroupID, imageTypeID };
    }

    public async getImageTagGroupHasImageTypeWithXLock(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<{ imageTagGroupID: number; imageTypeID: number } | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID]:
                        imageTagGroupID,
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeID]:
                        imageTypeID,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error(
                "failed to get image tag group has image type relation",
                { imageTagGroupID, imageTypeID, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info(
                "no image tag group has image type relation found found",
                { imageTagGroupID, imageTypeID }
            );
            return null;
        }
        if (rows.length > 1) {
            this.logger.info(
                "more than one image tag group has image type relation found found",
                { imageTagGroupID, imageTypeID }
            );
            throw new ErrorWithStatus(
                "more than one relation was found",
                status.INTERNAL
            );
        }
        return { imageTagGroupID, imageTypeID };
    }

    public async getImageTypeListOfImageTagGroupList(
        imageTagGroupIDList: number[]
    ): Promise<ImageType[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .join(
                    TabNameImageServiceImageType,
                    ColNameImageServiceImageTagGroupHasImageTypeImageTypeID,
                    ColNameImageServiceImageTypeID
                )
                .whereIn(
                    ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID,
                    imageTagGroupIDList
                )
                .orderBy(
                    ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID,
                    "asc"
                );

            const imageTagGroupIDToImageTypeList = new Map<
                number,
                ImageType[]
            >();
            for (const row of rows) {
                const imageTagGroupID =
                    +row[
                        ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID
                    ];
                if (!imageTagGroupIDToImageTypeList.has(imageTagGroupID)) {
                    imageTagGroupIDToImageTypeList.set(imageTagGroupID, []);
                }
                imageTagGroupIDToImageTypeList
                    .get(imageTagGroupID)
                    ?.push(
                        new ImageType(
                            +row[
                                ColNameImageServiceImageTagGroupHasImageTypeImageTypeID
                            ],
                            row[ColNameImageServiceImageTypeDisplayName],
                            row[ColNameImageServiceImageTypeHasPredictiveModel]
                        )
                    );
            }

            const results: ImageType[][] = [];
            for (const imageTagGroupID of imageTagGroupIDList) {
                results.push(
                    imageTagGroupIDToImageTypeList.get(imageTagGroupID) || []
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
        imageTypeID: number
    ): Promise<ImageTagGroup[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasImageType)
                .join(
                    TabNameImageServiceImageTagGroup,
                    ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID,
                    ColNameImageServiceImageTagGroupID
                )
                .where({
                    [ColNameImageServiceImageTagGroupHasImageTypeImageTypeID]:
                        imageTypeID,
                });

            return rows.map(
                (row) =>
                    new ImageTagGroup(
                        +row[
                            ColNameImageServiceImageTagGroupHasImageTypeImageTagGroupID
                        ],
                        row[ColNameImageServiceImageTagGroupDisplayName],
                        row[ColNameImageServiceImageTagGroupIsSingleValue]
                    )
            );
        } catch (error) {
            this.logger.error(
                "failed to get image tag group list of image type id",
                { imageTypeID, error }
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
