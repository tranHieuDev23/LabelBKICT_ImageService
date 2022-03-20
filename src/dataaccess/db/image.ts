import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageType, ImageStatus, ImageListSortOrder, Image } from "./models";

export class ImageListFilterOptions {
    public imageIDList: number[] = [];
    public imageTypeIDList: number[] = [];
    public uploadedByUserIDList: number[] = [];
    public publishedByUserIDList: number[] = [];
    public verifiedByUserIDList: number[] = [];
    public uploadTimeStart = 0;
    public uploadTimeEnd = 0;
    public publishTimeStart = 0;
    public publishTimeEnd = 0;
    public verifyTimeStart = 0;
    public verifyTimeEnd = 0;
    public originalFileNameQuery = "";
    public imageStatusList: ImageStatus[] = [];
}

export interface CreateImageArguments {
    uploadedByUserID: number;
    uploadTime: number;
    publishedByUserID: number;
    publishTime: number;
    verifiedByUserID: number;
    verifyTime: number;
    originalFileName: string;
    originalImageFilename: string;
    thumbnailImageFilename: string;
    description: string;
    imageTypeID: number | null;
    status: ImageStatus;
}

export interface UpdateImageArguments {
    uploadedByUserID: number;
    uploadTime: number;
    publishedByUserID: number;
    publishTime: number;
    verifiedByUserID: number;
    verifyTime: number;
    originalFileName: string;
    originalImageFilename: string;
    thumbnailImageFilename: string;
    description: string;
    imageTypeID: number;
    status: ImageStatus;
}

export interface ImageDataAccessor {
    createImage(args: CreateImageArguments): Promise<number>;
    getImage(id: number): Promise<Image | null>;
    getImageList(
        offset: number,
        limit: number,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<Image[]>;
    getImageCount(filterOptions: ImageListFilterOptions): Promise<number>;
    updateImage(args: UpdateImageArguments): Promise<void>;
    deleteImage(id: number): Promise<void>;
    deleteImageList(idList: number[]): Promise<void>;
    withTransaction<T>(
        executeFunc: (dataAccessor: ImageDataAccessor) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceImage = "image_service_image_tab";
const ColNameImageServiceImageID = "id";
const ColNameImageServiceImageUploadedByUserID = "uploaded_by_user_id";
const ColNameImageServiceImageUploadTime = "uploadTime";
const ColNameImageServiceImagePublishedByUserID = "published_by_user_id";
const ColNameImageServiceImagePublishTime = "publishTime";
const ColNameImageServiceImageVerifiedByUserID = "verify_by_user_id";
const ColNameImageServiceImageVerifyTime = "verifyTime";
const ColNameImageServiceImageOriginalFileName = "original_file_name";
const ColNameImageServiceImageOriginalImageFilename = "original_image_filename";
const ColNameImageServiceImageThumbnailImageFilename =
    "thumbnail_image_filename";
const ColNameImageServiceImageDescription = "description";
const ColNameImageServiceImageImageTypeID = "image_type_id";
const ColNameImageServiceImageStatus = "status";

const TabNameImageServiceImageType = "image_service_image_type_tab";
const ColNameImageServiceImageTypeID = "id";
const ColNameImageServiceImageTypeDisplayName = "display_name";
const ColNameImageServiceImageTypeHasPredictiveModel = "has_predictive_model";

export class ImageDataAccessorImpl implements ImageDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImage(args: CreateImageArguments): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageUploadedByUserID]:
                        args.uploadedByUserID,
                    [ColNameImageServiceImageUploadTime]: args.uploadTime,
                    [ColNameImageServiceImagePublishedByUserID]:
                        args.publishedByUserID,
                    [ColNameImageServiceImagePublishTime]: args.publishTime,
                    [ColNameImageServiceImageVerifiedByUserID]:
                        args.verifiedByUserID,
                    [ColNameImageServiceImageVerifyTime]: args.verifyTime,
                    [ColNameImageServiceImageOriginalFileName]:
                        args.originalFileName,
                    [ColNameImageServiceImageOriginalImageFilename]:
                        args.originalImageFilename,
                    [ColNameImageServiceImageThumbnailImageFilename]:
                        args.thumbnailImageFilename,
                    [ColNameImageServiceImageDescription]: args.description,
                    [ColNameImageServiceImageImageTypeID]: args.imageTypeID,
                    [ColNameImageServiceImageStatus]: args.status,
                })
                .returning([ColNameImageServiceImageID])
                .into(TabNameImageServiceImage);
            return +rows[0][ColNameImageServiceImageID];
        } catch (error) {
            this.logger.error("failed to create image", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImage(id: number): Promise<Image | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImage)
                .leftOuterJoin(
                    TabNameImageServiceImageType,
                    ColNameImageServiceImageImageTypeID,
                    ColNameImageServiceImageTypeID
                )
                .where({
                    [ColNameImageServiceImageID]: id,
                });
        } catch (error) {
            this.logger.error("failed to get image", { imageID: id, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }

        if (rows.length === 0) {
            this.logger.debug("no image with image_id found", { imageID: id });
            return null;
        }

        if (rows.length > 1) {
            this.logger.error("more than one image with image_id found", {
                imageID: id,
            });
            throw new ErrorWithStatus(
                "more than one image was found",
                status.INTERNAL
            );
        }

        return this.getImageFrowJoinedRow(rows[0]);
    }

    public async getImageList(
        offset: number,
        limit: number,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<Image[]> {
        try {
            let queryBuilder = this.knex
                .select()
                .from(TabNameImageServiceImage)
                .leftOuterJoin(
                    TabNameImageServiceImageType,
                    ColNameImageServiceImageImageTypeID,
                    ColNameImageServiceImageTypeID
                )
                .offset(offset)
                .limit(limit);
            queryBuilder = this.applyImageListSortOrder(
                queryBuilder,
                sortOrder
            );
            queryBuilder = this.applyImageListFilterOptions(
                queryBuilder,
                filterOptions
            );
            const rows = await queryBuilder;
            return rows.map((row) => this.getImageFrowJoinedRow(row));
        } catch (error) {
            this.logger.error("failed to get image list", {
                offset,
                limit,
                sortOrder,
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageCount(
        filterOptions: ImageListFilterOptions
    ): Promise<number> {
        try {
            let queryBuilder = this.knex.count().from(TabNameImageServiceImage);
            queryBuilder = this.applyImageListFilterOptions(
                queryBuilder,
                filterOptions
            );
            const rows = await queryBuilder;
            return +rows[0];
        } catch (error) {
            this.logger.error("failed to get image count", {
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateImage(args: UpdateImageArguments): Promise<void> {
        try {
            await this.knex.table(TabNameImageServiceImage).update({
                [ColNameImageServiceImageUploadedByUserID]:
                    args.uploadedByUserID,
                [ColNameImageServiceImageUploadTime]: args.uploadTime,
                [ColNameImageServiceImagePublishedByUserID]:
                    args.publishedByUserID,
                [ColNameImageServiceImagePublishTime]: args.publishTime,
                [ColNameImageServiceImageVerifiedByUserID]:
                    args.verifiedByUserID,
                [ColNameImageServiceImageVerifyTime]: args.verifyTime,
                [ColNameImageServiceImageOriginalFileName]:
                    args.originalFileName,
                [ColNameImageServiceImageOriginalImageFilename]:
                    args.originalImageFilename,
                [ColNameImageServiceImageThumbnailImageFilename]:
                    args.thumbnailImageFilename,
                [ColNameImageServiceImageDescription]: args.description,
                [ColNameImageServiceImageImageTypeID]: args.imageTypeID,
                [ColNameImageServiceImageStatus]: args.status,
            });
        } catch (error) {
            this.logger.error("failed to update image", { args, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImage(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImage)
                .where({
                    [ColNameImageServiceImageID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image", { imageID: id, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image with image_id found", { imageID: id });
            throw new ErrorWithStatus(
                `no image with image_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    public async deleteImageList(idList: number[]): Promise<void> {
        try {
            await this.knex
                .delete()
                .from(TabNameImageServiceImage)
                .whereIn(ColNameImageServiceImageID, idList);
        } catch (error) {
            this.logger.error("failed to delete image", {
                imageIDList: idList,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: ImageDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private applyImageListFilterOptions(
        qb: Knex.QueryBuilder,
        filterOptions: ImageListFilterOptions
    ): Knex.QueryBuilder {
        const queryCallbackList: Knex.QueryCallback[] = [];
        if (filterOptions.imageIDList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(
                    ColNameImageServiceImageID,
                    filterOptions.imageIDList
                );
            });
        }
        if (filterOptions.imageTypeIDList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(
                    ColNameImageServiceImageTypeID,
                    filterOptions.imageTypeIDList
                );
            });
        }
        if (filterOptions.uploadedByUserIDList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(
                    ColNameImageServiceImageUploadedByUserID,
                    filterOptions.uploadedByUserIDList
                );
            });
        }
        if (filterOptions.publishedByUserIDList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageStatus,
                    "=",
                    ImageStatus.VERIFIED
                ).andWhere((qb) => {
                    qb.whereIn(
                        ColNameImageServiceImagePublishedByUserID,
                        filterOptions.publishedByUserIDList
                    );
                });
            });
        }
        if (filterOptions.verifiedByUserIDList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageStatus,
                    "=",
                    ImageStatus.VERIFIED
                ).andWhere((qb) => {
                    qb.whereIn(
                        ColNameImageServiceImageVerifiedByUserID,
                        filterOptions.verifiedByUserIDList
                    );
                });
            });
        }
        if (filterOptions.uploadTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageUploadTime,
                    ">=",
                    filterOptions.uploadTimeStart
                );
            });
        }
        if (filterOptions.uploadTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageUploadTime,
                    "<=",
                    filterOptions.uploadTimeEnd
                );
            });
        }
        if (filterOptions.publishTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, [
                    ImageStatus.PUBLISHED,
                    ImageStatus.VERIFIED,
                ]).andWhere(
                    ColNameImageServiceImagePublishTime,
                    ">=",
                    filterOptions.uploadTimeStart
                );
            });
        }
        if (filterOptions.publishTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, [
                    ImageStatus.PUBLISHED,
                    ImageStatus.VERIFIED,
                ]).andWhere(
                    ColNameImageServiceImagePublishTime,
                    "<=",
                    filterOptions.uploadTimeEnd
                );
            });
        }
        if (filterOptions.verifyTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageStatus,
                    "=",
                    ImageStatus.VERIFIED
                ).andWhere(
                    ColNameImageServiceImageVerifyTime,
                    ">=",
                    filterOptions.uploadTimeStart
                );
            });
        }
        if (filterOptions.verifyTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(
                    ColNameImageServiceImageStatus,
                    "=",
                    ImageStatus.VERIFIED
                ).andWhere(
                    ColNameImageServiceImageVerifyTime,
                    "<=",
                    filterOptions.uploadTimeEnd
                );
            });
        }
        if (filterOptions.originalFileNameQuery !== "") {
            queryCallbackList.push((qb) => {
                qb.whereLike(
                    ColNameImageServiceImageOriginalFileName,
                    filterOptions.originalFileNameQuery
                );
            });
        }
        if (filterOptions.imageStatusList.length !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(
                    ColNameImageServiceImageStatus,
                    filterOptions.imageStatusList
                );
            });
        }

        if (queryCallbackList.length === 0) {
            return qb;
        }

        qb = qb.where(queryCallbackList[0]);
        for (let i = 1; i < queryCallbackList.length; i++) {
            qb = qb.andWhere(queryCallbackList[i]);
        }
        return qb;
    }

    private applyImageListSortOrder(
        qb: Knex.QueryBuilder,
        sortOption: ImageListSortOrder
    ): Knex.QueryBuilder {
        switch (sortOption) {
            case ImageListSortOrder.ID_ASCENDING:
                return qb.orderBy(ColNameImageServiceImageID, "asc");
            case ImageListSortOrder.ID_DESCENDING:
                return qb.orderBy(ColNameImageServiceImageID, "desc");
            case ImageListSortOrder.UPLOAD_TIME_ASCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageUploadTime, "asc")
                    .orderBy(ColNameImageServiceImageID, "asc");
            case ImageListSortOrder.UPLOAD_TIME_DESCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageUploadTime, "desc")
                    .orderBy(ColNameImageServiceImageID, "desc");
            case ImageListSortOrder.PUBLISH_TIME_ASCENDING:
                return qb
                    .orderBy(ColNameImageServiceImagePublishTime, "asc")
                    .orderBy(ColNameImageServiceImageID, "asc");
            case ImageListSortOrder.PUBLISH_TIME_DESCENDING:
                return qb.orderBy(ColNameImageServiceImagePublishTime, "desc");
            case ImageListSortOrder.VERIFY_TIME_ASCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageVerifyTime, "asc")
                    .orderBy(ColNameImageServiceImageID, "asc");
            case ImageListSortOrder.VERIFY_TIME_DESCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageVerifyTime, "desc")
                    .orderBy(ColNameImageServiceImageID, "desc");
            default:
                throw new ErrorWithStatus(
                    "invalid image list sort order",
                    status.INVALID_ARGUMENT
                );
        }
    }

    private getImageFrowJoinedRow(row: Record<string, any>): Image {
        let imageType: ImageType | null = null;
        if (row[ColNameImageServiceImageImageTypeID]) {
            imageType = new ImageType(
                row[ColNameImageServiceImageImageTypeID],
                row[ColNameImageServiceImageTypeDisplayName],
                row[ColNameImageServiceImageTypeHasPredictiveModel]
            );
        }
        return new Image(
            +row[ColNameImageServiceImageID],
            +row[ColNameImageServiceImageUploadedByUserID],
            +row[ColNameImageServiceImageUploadTime],
            +row[ColNameImageServiceImagePublishedByUserID],
            +row[ColNameImageServiceImagePublishTime],
            +row[ColNameImageServiceImageVerifiedByUserID],
            row[ColNameImageServiceImageVerifyTime],
            row[ColNameImageServiceImageOriginalFileName],
            row[ColNameImageServiceImageOriginalImageFilename],
            row[ColNameImageServiceImageThumbnailImageFilename],
            row[ColNameImageServiceImageDescription],
            imageType,
            +row[ColNameImageServiceImageStatus]
        );
    }
}

injected(ImageDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_DATA_ACCESSOR_TOKEN =
    token<ImageDataAccessor>("ImageDataAccessor");
