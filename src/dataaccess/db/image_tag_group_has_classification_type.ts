import { Knex } from "knex";
import { Logger, log } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ClassificationType } from "./models";

export interface ImageTagGroupHasClassificationTypeDataAccessor {
    createImageTagGroupHasClassificationType(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void>;
    deleteImageTagGroupHasClassificationType(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void>;
    getImageTagGroupHasClassificationTypeList(imageTagGroupIdList: number[]): Promise<number[][]>;
    convertToClassificationTypeObject(
        classificationTypeId: number,
        displayName: string
    ): ClassificationType;
    getImageTagGroupHasClassificationType(
        imageTagGroupId: number, 
        lassificationType: string
    ): Promise<{
        imageTagGroupId: number,
        classificationTypeDisplayName: string
    } | null>;
    getImageTagGroupHasClassificationTypeWithXLock(
        imageTagGroupId: number, 
        classificationTypeId: number
    ): Promise<{
        imageTagGroupId: number,
        classificationTypeId: number
    } | null>
    withTransaction<T>(executeFunc: (dataAccessor: ImageTagGroupHasClassificationTypeDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceImageTagGroupHasClassificationType =
    "image_service_image_tag_group_has_classification_type_tab";
const ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId = "image_tag_group_id";
const ColNameImageServiceImageTagGroupHasClassificationTypeClassificationTypeId = "classification_type_id";

export class ImageTagGroupHasClassificationTypeDataAccessorImpl implements ImageTagGroupHasClassificationTypeDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}
    
    public async createImageTagGroupHasClassificationType(imageTagGroupId: number, classificationTypeId: number): Promise<void> {
        try {
            await this.knex
            .insert({
                [ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId]: imageTagGroupId,
                [ColNameImageServiceImageTagGroupHasClassificationTypeClassificationTypeId]: classificationTypeId
            })
            .into(TabNameImageServiceImageTagGroupHasClassificationType);
        } catch (error) {
            this.logger.error("failed to create classification type has image tag group relation", {
                imageTagGroupId,
                classificationTypeId,
                error,
            })
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageTagGroupHasClassificationType(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageTagGroupHasClassificationType)
                .where({
                    [ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId]: imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasClassificationTypeClassificationTypeId]: classificationTypeId,
                });
        } catch (error) {
            this.logger.error("failed to delete classification type has image tag group relation", {
                imageTagGroupId,
                classificationTypeId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.debug("no classification type has user image tag group relation found", {
                imageTagGroupId,
                classificationTypeId,
            });
            throw new ErrorWithStatus(
                `no classification type has image tag group relation found with classification_type_id ${classificationTypeId}, image_tag_group_id ${imageTagGroupId}`,
                status.NOT_FOUND
            );
        }
    }

    public async getImageTagGroupHasClassificationTypeList(imageTagGroupIdList: number[]): Promise<number[][]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasClassificationType)
                .whereIn(ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId, imageTagGroupIdList)
                .orderBy(ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId, "asc");

            const imageTagGroupIdHasClassificationTypeList = new Map<number, number[]>();
            for (const row of rows) {
                const imageTagGroupId = +row[ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId];
                if (!imageTagGroupIdHasClassificationTypeList.has(imageTagGroupId)) {
                    imageTagGroupIdHasClassificationTypeList.set(imageTagGroupId, []);
                }
                imageTagGroupIdHasClassificationTypeList
                    .get(imageTagGroupId)
                    ?.push(+row[ColNameImageServiceImageTagGroupHasClassificationTypeClassificationTypeId]);
            }

            const results: number[][] = [];
            for (const imageTagGroupId of imageTagGroupIdList) {
                results.push(imageTagGroupIdHasClassificationTypeList.get(imageTagGroupId) || []);
            }

            return results;
        } catch (error) {
            this.logger.error("failed to get image type list of image tag group id list", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public convertToClassificationTypeObject(
        classificationTypeId: number,
        displayName: string
    ): ClassificationType {
        return new ClassificationType(classificationTypeId, displayName);
    }

    getImageTagGroupHasClassificationType(imageTagGroupId: number, lassificationType: string): Promise<{ imageTagGroupId: number; classificationTypeDisplayName: string; } | null> {
        throw new Error("Method not implemented.");
    }

    public async getImageTagGroupHasClassificationTypeWithXLock(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<{ imageTagGroupId: number; classificationTypeId: number } | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImageTagGroupHasClassificationType)
                .where({
                    [ColNameImageServiceImageTagGroupHasClassificationTypeImageTagGroupId]: imageTagGroupId,
                    [ColNameImageServiceImageTagGroupHasClassificationTypeClassificationTypeId]: classificationTypeId,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get image tag group has classification type relation", {
                imageTagGroupId,
                classificationTypeId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (rows.length === 0) {
            this.logger.info("no image tag group has classification type relation found found", {
                imageTagGroupId,
                classificationTypeId,
            });
            return null;
        }
        if (rows.length > 1) {
            this.logger.info("more than one image tag group has classification type relation found found", {
                imageTagGroupId,
                classificationTypeId,
            });
            throw new ErrorWithStatus("more than one relation was found", status.INTERNAL);
        }
        return { imageTagGroupId, classificationTypeId };
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: ImageTagGroupHasClassificationTypeDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageTagGroupHasClassificationTypeDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        })
    }
    
}

injected(
    ImageTagGroupHasClassificationTypeDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_TAG_GROUP_HAS_CLASSIFICATION_TYPE_DATA_ACCESSOR_TOKEN 
    = token<ImageTagGroupHasClassificationTypeDataAccessor>("ImageTagGroupHasClassificationTypeDataAccessor");