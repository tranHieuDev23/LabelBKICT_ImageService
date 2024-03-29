import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageType, ImageListSortOrder, Image } from "./models";

export class ImageListFilterOptions {
    public shouldFilterByImageIdList = false;
    public imageIdList: number[] = [];
    public imageTypeIdList: (number | null)[] = [];
    public uploadedByUserIdList: number[] = [];
    public notUploadedByUserIdList: number[] = [];
    public publishedByUserIdList: number[] = [];
    public verifiedByUserIdList: number[] = [];
    public uploadTimeStart = 0;
    public uploadTimeEnd = 0;
    public publishTimeStart = 0;
    public publishTimeEnd = 0;
    public verifyTimeStart = 0;
    public verifyTimeEnd = 0;
    public originalFileNameQuery = "";
    public imageStatusList: _ImageStatus_Values[] = [];
    public mustHaveDescription = false;
    public originalImageNameList: string[] = [];
}

export interface CreateImageArguments {
    uploadedByUserId: number;
    uploadTime: number;
    publishedByUserId: number;
    publishTime: number;
    verifiedByUserId: number;
    verifyTime: number;
    originalFileName: string;
    originalImageFilename: string;
    thumbnailImageFilename: string;
    description: string;
    imageTypeId: number | null;
    status: _ImageStatus_Values;
}

export interface UpdateImageArguments {
    id: number;
    publishedByUserId: number;
    publishTime: number;
    verifiedByUserId: number;
    verifyTime: number;
    description: string;
    imageTypeId: number | null;
    status: _ImageStatus_Values;
}

export interface ImageDataAccessor {
    createImage(args: CreateImageArguments): Promise<number>;
    getImage(id: number): Promise<Image | null>;
    getImageListWithIdList(idList: number[]): Promise<(Image | null)[]>;
    getImageWithXLock(id: number): Promise<Image | null>;
    getImageList(
        offset: number,
        limit: number | undefined,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<Image[]>;
    getImageIdList(
        offset: number,
        limit: number | undefined,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number[]>;
    getImageCount(filterOptions: ImageListFilterOptions): Promise<number>;
    getPrevImageCount(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number>;
    getPrevImageId(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number | null>;
    getNextImageId(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number | null>;
    updateImage(args: UpdateImageArguments): Promise<void>;
    deleteImage(id: number): Promise<void>;
    deleteImageList(idList: number[]): Promise<void>;
    withTransaction<T>(executeFunc: (dataAccessor: ImageDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceImage = "image_service_image_tab";
const ColNameImageServiceImageId = "image_id";
const ColNameImageServiceImageUploadedByUserId = "uploaded_by_user_id";
const ColNameImageServiceImageUploadTime = "upload_time";
const ColNameImageServiceImagePublishedByUserId = "published_by_user_id";
const ColNameImageServiceImagePublishTime = "publish_time";
const ColNameImageServiceImageVerifiedByUserId = "verified_by_user_id";
const ColNameImageServiceImageVerifyTime = "verify_time";
const ColNameImageServiceImageOriginalFileName = "original_file_name";
const ColNameImageServiceImageOriginalImageFilename = "original_image_filename";
const ColNameImageServiceImageThumbnailImageFilename = "thumbnail_image_filename";
const ColNameImageServiceImageDescription = "description";
const ColNameImageServiceImageImageTypeId = "image_type_id";
const ColNameImageServiceImageStatus = "status";

const TabNameImageServiceImageType = "image_service_image_type_tab";
const ColNameImageServiceImageTypeId = "image_type_id";
const ColNameImageServiceImageTypeDisplayName = "display_name";
const ColNameImageServiceImageTypeHasPredictiveModel = "has_predictive_model";

export class ImageDataAccessorImpl implements ImageDataAccessor {
    constructor(private readonly knex: Knex<any, any[]>, private readonly logger: Logger) {}

    public async createImage(args: CreateImageArguments): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageUploadedByUserId]: args.uploadedByUserId,
                    [ColNameImageServiceImageUploadTime]: args.uploadTime,
                    [ColNameImageServiceImagePublishedByUserId]: args.publishedByUserId,
                    [ColNameImageServiceImagePublishTime]: args.publishTime,
                    [ColNameImageServiceImageVerifiedByUserId]: args.verifiedByUserId,
                    [ColNameImageServiceImageVerifyTime]: args.verifyTime,
                    [ColNameImageServiceImageOriginalFileName]: args.originalFileName,
                    [ColNameImageServiceImageOriginalImageFilename]: args.originalImageFilename,
                    [ColNameImageServiceImageThumbnailImageFilename]: args.thumbnailImageFilename,
                    [ColNameImageServiceImageDescription]: args.description,
                    [ColNameImageServiceImageImageTypeId]: args.imageTypeId,
                    [ColNameImageServiceImageStatus]: args.status,
                })
                .returning([ColNameImageServiceImageId])
                .into(TabNameImageServiceImage);
            return +rows[0][ColNameImageServiceImageId];
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
                    `${TabNameImageServiceImage}.${ColNameImageServiceImageImageTypeId}`,
                    `${TabNameImageServiceImageType}.${ColNameImageServiceImageTypeId}`
                )
                .where({
                    [ColNameImageServiceImageId]: id,
                });
        } catch (error) {
            this.logger.error("failed to get image", { imageId: id, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }

        if (rows.length === 0) {
            this.logger.debug("no image with image_id found", { imageId: id });
            return null;
        }

        if (rows.length > 1) {
            this.logger.error("more than one image with image_id found", {
                imageId: id,
            });
            throw new ErrorWithStatus("more than one image was found", status.INTERNAL);
        }

        return this.getImageFrowJoinedRow(rows[0]);
    }

    public async getImageListWithIdList(idList: number[]): Promise<(Image | null)[]> {
        return Promise.all(idList.map((id) => this.getImage(id)));
    }

    public async getImageWithXLock(id: number): Promise<Image | null> {
        let rows: Record<string, any>[];
        try {
            rows = await this.knex
                .select()
                .from(TabNameImageServiceImage)
                .where({
                    [ColNameImageServiceImageId]: id,
                })
                .forUpdate();
        } catch (error) {
            this.logger.error("failed to get image", { imageId: id, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }

        if (rows.length === 0) {
            this.logger.debug("no image with image_id found", { imageId: id });
            return null;
        }

        if (rows.length > 1) {
            this.logger.error("more than one image with image_id found", {
                imageId: id,
            });
            throw new ErrorWithStatus("more than one image was found", status.INTERNAL);
        }

        return this.getImageFrowRow(rows[0]);
    }

    public async getImageList(
        offset: number,
        limit: number | undefined,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<Image[]> {
        try {
            let queryBuilder = this.knex
                .select()
                .from(TabNameImageServiceImage)
                .leftOuterJoin(
                    TabNameImageServiceImageType,
                    `${TabNameImageServiceImage}.${ColNameImageServiceImageImageTypeId}`,
                    `${TabNameImageServiceImageType}.${ColNameImageServiceImageTypeId}`
                )
                .offset(offset);

            if (limit !== undefined) {
                queryBuilder = queryBuilder.limit(limit);
            }

            queryBuilder = this.applyImageListOrderByClause(queryBuilder, sortOrder);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
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

    public async getImageIdList(
        offset: number,
        limit: number | undefined,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number[]> {
        try {
            let queryBuilder = this.knex
                .select([ColNameImageServiceImageId])
                .from(TabNameImageServiceImage)
                .leftOuterJoin(
                    TabNameImageServiceImageType,
                    `${TabNameImageServiceImage}.${ColNameImageServiceImageImageTypeId}`,
                    `${TabNameImageServiceImageType}.${ColNameImageServiceImageTypeId}`
                )
                .offset(offset);

            if (limit !== undefined) {
                queryBuilder = queryBuilder.limit(limit);
            }

            queryBuilder = this.applyImageListOrderByClause(queryBuilder, sortOrder);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
            const rows = await queryBuilder;
            return rows.map((row) => +row[ColNameImageServiceImageId]);
        } catch (error) {
            this.logger.error("failed to get image id list", {
                offset,
                limit,
                sortOrder,
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageCount(filterOptions: ImageListFilterOptions): Promise<number> {
        try {
            let queryBuilder = this.knex.count().from(TabNameImageServiceImage);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
            const rows = (await queryBuilder) as any[];
            return +rows[0]["count"];
        } catch (error) {
            this.logger.error("failed to get image count", {
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getPrevImageCount(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number> {
        const oppositeSortOrder = this.getOppositeSortOrder(sortOrder);
        try {
            let queryBuilder = this.knex.count().from(TabNameImageServiceImage);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
            queryBuilder = queryBuilder.andWhere((qb) => {
                this.getNextImageListWhereClause(qb, image, oppositeSortOrder);
            });
            const rows = (await queryBuilder) as any[];
            return +rows[0]["count"];
        } catch (error) {
            this.logger.error("failed to get prev image count", {
                image,
                sortOrder,
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getPrevImageId(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number | null> {
        const oppositeSortOrder = this.getOppositeSortOrder(sortOrder);
        try {
            let queryBuilder = this.knex.select().from(TabNameImageServiceImage).limit(1);
            queryBuilder = this.applyImageListOrderByClause(queryBuilder, oppositeSortOrder);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
            queryBuilder = queryBuilder.andWhere((qb) => {
                this.getNextImageListWhereClause(qb, image, oppositeSortOrder);
            });
            const rows = await queryBuilder;
            if (rows.length === 0) {
                this.logger.debug("no prev image found", {
                    image,
                    sortOrder,
                    filterOptions,
                });
                return null;
            }
            return +rows[0][ColNameImageServiceImageId];
        } catch (error) {
            this.logger.error("failed to get prev image id", {
                image,
                sortOrder,
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getNextImageId(
        image: Image,
        sortOrder: ImageListSortOrder,
        filterOptions: ImageListFilterOptions
    ): Promise<number | null> {
        try {
            let queryBuilder = this.knex.select().from(TabNameImageServiceImage).limit(1);
            queryBuilder = this.applyImageListOrderByClause(queryBuilder, sortOrder);
            queryBuilder = queryBuilder.where((qb) => this.getImageListFilterOptionsWhereClause(qb, filterOptions));
            queryBuilder = queryBuilder.andWhere((qb) => {
                this.getNextImageListWhereClause(qb, image, sortOrder);
            });
            const rows = await queryBuilder;
            if (rows.length === 0) {
                this.logger.debug("no next image found", {
                    image,
                    sortOrder,
                    filterOptions,
                });
                return null;
            }
            return +rows[0][ColNameImageServiceImageId];
        } catch (error) {
            this.logger.error("failed to get next image id", {
                image,
                sortOrder,
                filterOptions,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateImage(args: UpdateImageArguments): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImage)
                .update({
                    [ColNameImageServiceImagePublishedByUserId]: args.publishedByUserId,
                    [ColNameImageServiceImagePublishTime]: args.publishTime,
                    [ColNameImageServiceImageVerifiedByUserId]: args.verifiedByUserId,
                    [ColNameImageServiceImageVerifyTime]: args.verifyTime,
                    [ColNameImageServiceImageDescription]: args.description,
                    [ColNameImageServiceImageImageTypeId]: args.imageTypeId,
                    [ColNameImageServiceImageStatus]: args.status,
                })
                .where({
                    [ColNameImageServiceImageId]: args.id,
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
                    [ColNameImageServiceImageId]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image", { imageId: id, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image with image_id found", { imageId: id });
            throw new ErrorWithStatus(`no image with image_id ${id} found`, status.NOT_FOUND);
        }
    }

    public async deleteImageList(idList: number[]): Promise<void> {
        try {
            await this.knex.delete().from(TabNameImageServiceImage).whereIn(ColNameImageServiceImageId, idList);
        } catch (error) {
            this.logger.error("failed to delete image", {
                imageIdList: idList,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(executeFunc: (dataAccessor: ImageDataAccessor) => Promise<T>): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new ImageDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private getImageListFilterOptionsWhereClause(
        qb: Knex.QueryBuilder,
        filterOptions: ImageListFilterOptions
    ): Knex.QueryBuilder {
        const queryCallbackList: Knex.QueryCallback[] = [];
        if (filterOptions.shouldFilterByImageIdList) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageId, filterOptions.imageIdList);
            });
        }
        if (filterOptions.imageTypeIdList.length > 0) {
            const hasNullImageType =
                filterOptions.imageTypeIdList.findIndex((imageTypeId) => imageTypeId === null) !== -1;
            queryCallbackList.push((qb) => {
                qb.whereIn(
                    `${TabNameImageServiceImage}.${ColNameImageServiceImageTypeId}`,
                    filterOptions.imageTypeIdList
                );
                if (hasNullImageType) {
                    qb.orWhereNull(`${TabNameImageServiceImage}.${ColNameImageServiceImageTypeId}`);
                }
            });
        }
        if (filterOptions.uploadedByUserIdList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageUploadedByUserId, filterOptions.uploadedByUserIdList);
            });
        }
        if (filterOptions.notUploadedByUserIdList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereNotIn(ColNameImageServiceImageUploadedByUserId, filterOptions.notUploadedByUserIdList);
            });
        }
        if (filterOptions.publishedByUserIdList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, [
                    _ImageStatus_Values.PUBLISHED,
                    _ImageStatus_Values.VERIFIED,
                ]).andWhere((qb) => {
                    qb.whereIn(ColNameImageServiceImagePublishedByUserId, filterOptions.publishedByUserIdList);
                });
            });
        }
        if (filterOptions.verifiedByUserIdList.length > 0) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageStatus, "=", _ImageStatus_Values.VERIFIED).andWhere((qb) => {
                    qb.whereIn(ColNameImageServiceImageVerifiedByUserId, filterOptions.verifiedByUserIdList);
                });
            });
        }
        if (filterOptions.uploadTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageUploadTime, ">=", filterOptions.uploadTimeStart);
            });
        }
        if (filterOptions.uploadTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageUploadTime, "<=", filterOptions.uploadTimeEnd);
            });
        }
        if (filterOptions.publishTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, [
                    _ImageStatus_Values.PUBLISHED,
                    _ImageStatus_Values.VERIFIED,
                ]).andWhere(ColNameImageServiceImagePublishTime, ">=", filterOptions.publishTimeStart);
            });
        }
        if (filterOptions.publishTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, [
                    _ImageStatus_Values.PUBLISHED,
                    _ImageStatus_Values.VERIFIED,
                ]).andWhere(ColNameImageServiceImagePublishTime, "<=", filterOptions.publishTimeEnd);
            });
        }
        if (filterOptions.verifyTimeStart !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageStatus, "=", _ImageStatus_Values.VERIFIED).andWhere(
                    ColNameImageServiceImageVerifyTime,
                    ">=",
                    filterOptions.verifyTimeStart
                );
            });
        }
        if (filterOptions.verifyTimeEnd !== 0) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageStatus, "=", _ImageStatus_Values.VERIFIED).andWhere(
                    ColNameImageServiceImageVerifyTime,
                    "<=",
                    filterOptions.verifyTimeEnd
                );
            });
        }
        if (filterOptions.originalFileNameQuery !== "") {
            queryCallbackList.push((qb) => {
                qb.whereLike(ColNameImageServiceImageOriginalFileName, `%${filterOptions.originalFileNameQuery}%`);
            });
        }
        if (filterOptions.imageStatusList.length !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageStatus, filterOptions.imageStatusList);
            });
        }
        if (filterOptions.mustHaveDescription) {
            queryCallbackList.push((qb) => {
                qb.where(ColNameImageServiceImageDescription, "!=", "");
            });
        }
        if (filterOptions.originalImageNameList.length !== 0) {
            queryCallbackList.push((qb) => {
                qb.whereIn(ColNameImageServiceImageOriginalFileName, filterOptions.originalImageNameList).andWhere(
                    ColNameImageServiceImageOriginalFileName,
                    "!=",
                    ""
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

    private applyImageListOrderByClause(qb: Knex.QueryBuilder, sortOption: ImageListSortOrder): Knex.QueryBuilder {
        switch (sortOption) {
            case ImageListSortOrder.ID_ASCENDING:
                return qb.orderBy(ColNameImageServiceImageId, "asc");
            case ImageListSortOrder.ID_DESCENDING:
                return qb.orderBy(ColNameImageServiceImageId, "desc");
            case ImageListSortOrder.UPLOAD_TIME_ASCENDING:
                return qb.orderBy(ColNameImageServiceImageUploadTime, "asc").orderBy(ColNameImageServiceImageId, "asc");
            case ImageListSortOrder.UPLOAD_TIME_DESCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageUploadTime, "desc")
                    .orderBy(ColNameImageServiceImageId, "desc");
            case ImageListSortOrder.PUBLISH_TIME_ASCENDING:
                return qb
                    .orderBy(ColNameImageServiceImagePublishTime, "asc")
                    .orderBy(ColNameImageServiceImageId, "asc");
            case ImageListSortOrder.PUBLISH_TIME_DESCENDING:
                return qb.orderBy(ColNameImageServiceImagePublishTime, "desc");
            case ImageListSortOrder.VERIFY_TIME_ASCENDING:
                return qb.orderBy(ColNameImageServiceImageVerifyTime, "asc").orderBy(ColNameImageServiceImageId, "asc");
            case ImageListSortOrder.VERIFY_TIME_DESCENDING:
                return qb
                    .orderBy(ColNameImageServiceImageVerifyTime, "desc")
                    .orderBy(ColNameImageServiceImageId, "desc");
            default:
                throw new ErrorWithStatus("invalid image list sort order", status.INVALID_ARGUMENT);
        }
    }

    private getOppositeSortOrder(sortOrder: ImageListSortOrder): ImageListSortOrder {
        switch (sortOrder) {
            case ImageListSortOrder.ID_ASCENDING:
                return ImageListSortOrder.ID_DESCENDING;
            case ImageListSortOrder.ID_DESCENDING:
                return ImageListSortOrder.ID_ASCENDING;
            case ImageListSortOrder.UPLOAD_TIME_ASCENDING:
                return ImageListSortOrder.UPLOAD_TIME_DESCENDING;
            case ImageListSortOrder.UPLOAD_TIME_DESCENDING:
                return ImageListSortOrder.UPLOAD_TIME_ASCENDING;
            case ImageListSortOrder.PUBLISH_TIME_ASCENDING:
                return ImageListSortOrder.PUBLISH_TIME_DESCENDING;
            case ImageListSortOrder.PUBLISH_TIME_DESCENDING:
                return ImageListSortOrder.PUBLISH_TIME_ASCENDING;
            case ImageListSortOrder.VERIFY_TIME_ASCENDING:
                return ImageListSortOrder.VERIFY_TIME_DESCENDING;
            case ImageListSortOrder.VERIFY_TIME_DESCENDING:
                return ImageListSortOrder.VERIFY_TIME_ASCENDING;
        }
    }

    private getNextImageListWhereClause(
        qb: Knex.QueryBuilder,
        image: Image,
        sortOrder: ImageListSortOrder
    ): Knex.QueryBuilder {
        switch (sortOrder) {
            case ImageListSortOrder.ID_ASCENDING:
                return qb.where(ColNameImageServiceImageId, ">", image.id);
            case ImageListSortOrder.ID_DESCENDING:
                return qb.where(ColNameImageServiceImageId, "<", image.id);
            case ImageListSortOrder.UPLOAD_TIME_ASCENDING:
                return qb
                    .where(ColNameImageServiceImageUploadTime, ">", image.uploadTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImageUploadTime, "=", image.uploadTime)
                            .andWhere(ColNameImageServiceImageId, ">", image.id)
                    );
            case ImageListSortOrder.UPLOAD_TIME_DESCENDING:
                return qb
                    .where(ColNameImageServiceImageUploadTime, "<", image.uploadTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImageUploadTime, "=", image.uploadTime)
                            .andWhere(ColNameImageServiceImageId, "<", image.id)
                    );
            case ImageListSortOrder.PUBLISH_TIME_ASCENDING:
                return qb
                    .where(ColNameImageServiceImagePublishTime, ">", image.publishTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImagePublishTime, "=", image.publishTime)
                            .andWhere(ColNameImageServiceImageId, ">", image.id)
                    );
            case ImageListSortOrder.PUBLISH_TIME_DESCENDING:
                return qb
                    .where(ColNameImageServiceImagePublishTime, "<", image.publishTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImagePublishTime, "=", image.publishTime)
                            .andWhere(ColNameImageServiceImageId, "<", image.id)
                    );
            case ImageListSortOrder.VERIFY_TIME_ASCENDING:
                return qb
                    .where(ColNameImageServiceImageVerifyTime, ">", image.verifyTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImageVerifyTime, "=", image.verifyTime)
                            .andWhere(ColNameImageServiceImageId, ">", image.id)
                    );
            case ImageListSortOrder.VERIFY_TIME_DESCENDING:
                return qb
                    .where(ColNameImageServiceImageVerifyTime, "<", image.verifyTime)
                    .orWhere((qb) =>
                        qb
                            .where(ColNameImageServiceImageVerifyTime, "=", image.verifyTime)
                            .andWhere(ColNameImageServiceImageId, "<", image.id)
                    );
        }
    }

    private getImageFrowRow(row: Record<string, any>): Image {
        let imageType: ImageType | null = null;
        if (row[ColNameImageServiceImageImageTypeId]) {
            imageType = new ImageType(row[ColNameImageServiceImageImageTypeId], "", false);
        }
        return new Image(
            +row[ColNameImageServiceImageId],
            +row[ColNameImageServiceImageUploadedByUserId],
            +row[ColNameImageServiceImageUploadTime],
            +row[ColNameImageServiceImagePublishedByUserId],
            +row[ColNameImageServiceImagePublishTime],
            +row[ColNameImageServiceImageVerifiedByUserId],
            row[ColNameImageServiceImageVerifyTime],
            row[ColNameImageServiceImageOriginalFileName],
            row[ColNameImageServiceImageOriginalImageFilename],
            row[ColNameImageServiceImageThumbnailImageFilename],
            row[ColNameImageServiceImageDescription],
            imageType,
            +row[ColNameImageServiceImageStatus]
        );
    }

    private getImageFrowJoinedRow(row: Record<string, any>): Image {
        let imageType: ImageType | null = null;
        if (row[ColNameImageServiceImageImageTypeId]) {
            imageType = new ImageType(
                row[ColNameImageServiceImageImageTypeId],
                row[ColNameImageServiceImageTypeDisplayName],
                row[ColNameImageServiceImageTypeHasPredictiveModel]
            );
        }
        return new Image(
            +row[ColNameImageServiceImageId],
            +row[ColNameImageServiceImageUploadedByUserId],
            +row[ColNameImageServiceImageUploadTime],
            +row[ColNameImageServiceImagePublishedByUserId],
            +row[ColNameImageServiceImagePublishTime],
            +row[ColNameImageServiceImageVerifiedByUserId],
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

export const IMAGE_DATA_ACCESSOR_TOKEN = token<ImageDataAccessor>("ImageDataAccessor");
