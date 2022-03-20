import { status } from "@grpc/grpc-js";
import { join } from "path";
import validator from "validator";
import { Logger } from "winston";
import { ApplicationConfig } from "../../config";
import {
    ImageDataAccessor,
    ImageHasImageTagDataAccessor,
    ImageType,
    ImageTypeDataAccessor,
    RegionDataAccessor,
    ImageListFilterOptions as DMImageListFilterOptions,
    ImageListSortOrder,
} from "../../dataaccess/db";
import { Image } from "../../proto/gen/Image";
import { ImageListFilterOptions } from "../../proto/gen/ImageListFilterOptions";
import { _ImageListSortOrder_Values } from "../../proto/gen/ImageListSortOrder";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { ImageTag } from "../../proto/gen/ImageTag";
import { Region } from "../../proto/gen/Region";
import { ErrorWithStatus, IDGenerator, Timer } from "../../utils";
import { ImageProcessor } from "./image_processor";

export interface ImageManagementOperator {
    createImage(
        uploadedByUserID: number,
        originalFileName: string,
        imageData: Buffer,
        description: string | undefined,
        imageTypeID: number | undefined
    ): Promise<Image>;
    getImage(
        id: number,
        withImageTag: boolean,
        withRegion: boolean
    ): Promise<{
        image: Image;
        imageTagList: ImageTag[] | undefined;
        regionList: Region[] | undefined;
    }>;
    getImageList(
        offset: number,
        limit: number,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions,
        withImageTag: boolean,
        withRegion: boolean
    ): Promise<{
        totalImageCount: number;
        imageList: Image[];
        imageTagList: ImageTag[][] | undefined;
        regionList: Region[][] | undefined;
    }>;
    updateImageMetadata(
        id: number,
        description: string | undefined
    ): Promise<Image>;
    updateImageImageType(id: number, imageTypeID: number): Promise<Image>;
    updateImageStatus(
        id: number,
        status: _ImageStatus_Values,
        byUserID: number
    ): Promise<Image>;
    updateImageListImageType(
        idList: number[],
        imageTypeID: number
    ): Promise<void>;
    deleteImage(id: number): Promise<void>;
    deleteImageList(idList: number[]): Promise<void>;
    addImageTagToImage(imageID: number, imageTagID: number): Promise<void>;
    removeImageTagFromImage(imageID: number, imageTagID: number): Promise<void>;
}

const ORIGINAL_WIDTH = 1920;
const ORIGINAL_HEIGHT = 1080;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

export class ImageManagementOperatorImpl implements ImageManagementOperator {
    constructor(
        private readonly imageDM: ImageDataAccessor,
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly imageHasImageTagDM: ImageHasImageTagDataAccessor,
        private readonly regionDM: RegionDataAccessor,
        private readonly idGenerator: IDGenerator,
        private readonly timer: Timer,
        private readonly imageProcessor: ImageProcessor,
        private readonly applicationConfig: ApplicationConfig,
        private readonly logger: Logger
    ) {}

    public async createImage(
        uploadedByUserID: number,
        originalFileName: string,
        imageData: Buffer,
        description: string,
        imageTypeID: number | undefined
    ): Promise<Image> {
        originalFileName = this.sanitizeOriginalFileName(originalFileName);
        if (!this.isValidOriginalFileName(originalFileName)) {
            this.logger.error("invalid original file name", {
                originalFileName,
            });
            throw new ErrorWithStatus(
                `invalid original file name ${originalFileName}`,
                status.INVALID_ARGUMENT
            );
        }

        description = this.sanitizeDescription(description);

        let imageType: ImageType | null = null;
        if (imageTypeID !== undefined) {
            imageType = await this.imageTypeDM.getImageType(imageTypeID);
            if (imageType === null) {
                this.logger.error("image type with image_type_id not found", {
                    imageTypeID,
                });
                throw new ErrorWithStatus(
                    `image type with image_type_id ${imageTypeID} not found`,
                    status.NOT_FOUND
                );
            }
        }

        const uploadTime = this.timer.getCurrentTime();
        const originalImageFileName =
            this.generateOriginalImageFilename(uploadTime);
        const thumbnailImageFileName =
            this.generateThumbnailImageFilename(uploadTime);
        const originalImageFilePath = join(
            this.applicationConfig.originalImageDir,
            originalImageFileName
        );
        const thumbnailImageFilePath = join(
            this.applicationConfig.thumbnailImageDir,
            thumbnailImageFileName
        );

        try {
            Promise.all([
                this.imageProcessor
                    .resizeImage(imageData, ORIGINAL_WIDTH, ORIGINAL_HEIGHT)
                    .then((resizedBuffer) =>
                        this.imageProcessor.saveImageFile(
                            originalImageFilePath,
                            resizedBuffer
                        )
                    ),
                this.imageProcessor
                    .resizeImage(imageData, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
                    .then((resizedBuffer) =>
                        this.imageProcessor.saveImageFile(
                            thumbnailImageFilePath,
                            resizedBuffer
                        )
                    ),
            ]);
        } catch (error) {
            this.logger.error("failed to save image files", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }

        const uploadedImageID = await this.imageDM.createImage({
            uploadedByUserID: uploadedByUserID,
            uploadTime: uploadTime,
            publishedByUserID: 0,
            publishTime: 0,
            verifiedByUserID: 0,
            verifyTime: 0,
            originalFileName: originalFileName,
            originalImageFilename: originalImageFileName,
            thumbnailImageFilename: thumbnailImageFileName,
            description: description,
            imageTypeID: imageTypeID === undefined ? null : imageTypeID,
            status: _ImageStatus_Values.UPLOADED,
        });

        return {
            id: uploadedImageID,
            uploadedByUserId: uploadedByUserID,
            uploadTime: uploadTime,
            publishedByUserId: 0,
            publishTime: 0,
            verifiedByUserId: 0,
            verifyTime: 0,
            originalFileName: originalFileName,
            originalImageFilename: originalImageFileName,
            thumbnailImageFilename: thumbnailImageFileName,
            description: description,
            imageType: imageType,
            status: _ImageStatus_Values.UPLOADED,
        };
    }

    private sanitizeOriginalFileName(originalFileName: string): string {
        return validator.escape(validator.trim(originalFileName));
    }

    private isValidOriginalFileName(originalFileName: string): boolean {
        return validator.isLength(originalFileName, { max: 256 });
    }

    private sanitizeDescription(description: string): string {
        return validator.escape(validator.trim(description));
    }

    private generateOriginalImageFilename(uploadTime: number): string {
        return `original-${uploadTime}-${this.idGenerator.generate()}.jpeg`;
    }

    private generateThumbnailImageFilename(uploadTime: number): string {
        return `thumbnail-${uploadTime}-${this.idGenerator.generate()}.jpeg`;
    }

    public async getImage(
        id: number,
        withImageTag: boolean,
        withRegion: boolean
    ): Promise<{
        image: Image;
        imageTagList: ImageTag[] | undefined;
        regionList: Region[] | undefined;
    }> {
        const image = await this.imageDM.getImage(id);
        if (image === null) {
            this.logger.error("no image with image_id found", { imageID: id });
            throw new ErrorWithStatus(
                `no image with image_id ${id} found`,
                status.NOT_FOUND
            );
        }

        let imageTagList: ImageTag[] | undefined = undefined;
        if (withImageTag) {
            imageTagList = (
                await this.imageHasImageTagDM.getImageTagListOfImageList([id])
            )[0];
        }

        let regionList: Region[] | undefined = undefined;
        if (withRegion) {
            regionList = await this.regionDM.getRegionListOfImage(id);
        }

        return { image, imageTagList, regionList };
    }

    public async getImageList(
        offset: number,
        limit: number,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions,
        withImageTag: boolean,
        withRegion: boolean
    ): Promise<{
        totalImageCount: number;
        imageList: Image[];
        imageTagList: ImageTag[][] | undefined;
        regionList: Region[][] | undefined;
    }> {
        const dmFilterOptions = await this.getDMImageListFilterOptions(
            filterOptions
        );
        const totalImageCount = await this.imageDM.getImageCount(
            dmFilterOptions
        );
        const imageList = await this.imageDM.getImageList(
            offset,
            limit,
            this.getImageListSortOrder(sortOrder),
            dmFilterOptions
        );
        const imageIDList = imageList.map((image) => image.id);

        let imageTagList: ImageTag[][] | undefined = undefined;
        if (withImageTag) {
            imageTagList =
                await this.imageHasImageTagDM.getImageTagListOfImageList(
                    imageIDList
                );
        }

        let regionList: Region[][] | undefined = undefined;
        if (withRegion) {
            regionList = await this.regionDM.getRegionListOfImageList(
                imageIDList
            );
        }

        return { totalImageCount, imageList, imageTagList, regionList };
    }

    private async getDMImageListFilterOptions(
        filterOptions: ImageListFilterOptions
    ): Promise<DMImageListFilterOptions> {
        const dmFilterOptions = new DMImageListFilterOptions();

        dmFilterOptions.uploadedByUserIDList =
            filterOptions.uploadedByUserIdList || [];
        dmFilterOptions.uploadTimeStart = +(filterOptions.uploadTimeStart || 0);
        dmFilterOptions.uploadTimeEnd = +(filterOptions.uploadTimeEnd || 0);

        dmFilterOptions.publishedByUserIDList =
            filterOptions.publishedByUserIdList || [];
        dmFilterOptions.publishTimeStart = +(
            filterOptions.publishTimeStart || 0
        );
        dmFilterOptions.publishTimeEnd = +(filterOptions.publishTimeEnd || 0);

        dmFilterOptions.verifiedByUserIDList =
            filterOptions.verifiedByUserIdList || [];
        dmFilterOptions.verifyTimeStart = +(filterOptions.verifyTimeStart || 0);
        dmFilterOptions.verifyTimeEnd = +(filterOptions.verifyTimeEnd || 0);

        dmFilterOptions.imageTypeIDList = filterOptions.imageTypeIdList || [];
        dmFilterOptions.originalFileNameQuery =
            filterOptions.originalFileNameQuery || "";
        dmFilterOptions.imageStatusList = filterOptions.imageStatusList || [];

        const imageIDSet = new Set<number>();
        if (
            filterOptions.imageTagIdList !== undefined &&
            filterOptions.imageTagIdList.length > 0
        ) {
            const imageIDList =
                await this.imageHasImageTagDM.getImageIDListOfImageTagList(
                    filterOptions.imageTagIdList
                );
            for (const imageID of imageIDList) {
                imageIDSet.add(imageID);
            }
        }
        if (
            filterOptions.regionLabelIdList !== undefined &&
            filterOptions.regionLabelIdList.length > 0
        ) {
            const imageIDList =
                await this.regionDM.getOfImageIDListOfRegionLabelList(
                    filterOptions.regionLabelIdList
                );
            for (const imageID of imageIDList) {
                imageIDSet.add(imageID);
            }
        }
        dmFilterOptions.imageIDList = Array.from(imageIDSet);

        return dmFilterOptions;
    }

    private getImageListSortOrder(
        sortOrder: _ImageListSortOrder_Values
    ): ImageListSortOrder {
        switch (sortOrder) {
            case _ImageListSortOrder_Values.ID_ASCENDING:
                return ImageListSortOrder.ID_ASCENDING;
            case _ImageListSortOrder_Values.ID_DESCENDING:
                return ImageListSortOrder.ID_DESCENDING;
            case _ImageListSortOrder_Values.UPLOAD_TIME_ASCENDING:
                return ImageListSortOrder.UPLOAD_TIME_ASCENDING;
            case _ImageListSortOrder_Values.UPLOAD_TIME_DESCENDING:
                return ImageListSortOrder.UPLOAD_TIME_DESCENDING;
            case _ImageListSortOrder_Values.PUBLISH_TIME_ASCENDING:
                return ImageListSortOrder.PUBLISH_TIME_ASCENDING;
            case _ImageListSortOrder_Values.PUBLISH_TIME_DESCENDING:
                return ImageListSortOrder.PUBLISH_TIME_DESCENDING;
            case _ImageListSortOrder_Values.VERIFY_TIME_ASCENDING:
                return ImageListSortOrder.VERIFY_TIME_ASCENDING;
            case _ImageListSortOrder_Values.VERIFY_TIME_DESCENDING:
                return ImageListSortOrder.VERIFY_TIME_DESCENDING;
            default:
                this.logger.error("invalid sort_order value", { sortOrder });
                throw new ErrorWithStatus(
                    `invalid sort_order value ${sortOrder}`,
                    status.INVALID_ARGUMENT
                );
        }
    }

    public async updateImageMetadata(
        id: number,
        description: string | undefined
    ): Promise<Image> {
        if (description !== undefined) {
            description = this.sanitizeDescription(description);
        }
        return this.imageDM.withTransaction(async (dm) => {
            const image = await dm.getImage(id);
            if (image === null) {
                this.logger.error("no image with image_id found", {
                    imageID: id,
                });
                throw new ErrorWithStatus(
                    `no image with image_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (description !== undefined) {
                image.description = description;
            }

            await dm.updateImage({
                id: id,
                publishedByUserID: image.publishedByUserID,
                publishTime: image.publishTime,
                verifiedByUserID: image.verifiedByUserID,
                verifyTime: image.verifyTime,
                description: image.description,
                imageTypeID:
                    image.imageType === null ? null : image.imageType.id,
                status: image.status,
            });
            return image;
        });
    }

    public async updateImageImageType(
        id: number,
        imageTypeID: number
    ): Promise<Image> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeID);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeID,
            });
            throw new ErrorWithStatus(
                `image type with image_type_id ${imageTypeID} not found`,
                status.NOT_FOUND
            );
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImageWithXLock(id);
            if (image === null) {
                this.logger.error("image with image_id not found", {
                    imageID: id,
                });
                throw new ErrorWithStatus(
                    `image with image_id ${id} not found`,
                    status.NOT_FOUND
                );
            }

            return this.regionDM.withTransaction(async (regionDM) => {
                await regionDM.updateLabelOfRegionOfImage(id, null);

                return this.imageHasImageTagDM.withTransaction(
                    async (imageHasImageTagDM) => {
                        await imageHasImageTagDM.deleteImageHasImageTagOfImage(
                            id
                        );

                        image.imageType = imageType;
                        await imageDM.updateImage({
                            id: id,
                            publishedByUserID: image.publishedByUserID,
                            publishTime: image.publishTime,
                            verifiedByUserID: image.verifiedByUserID,
                            verifyTime: image.verifyTime,
                            description: image.description,
                            imageTypeID: imageTypeID,
                            status: image.status,
                        });

                        return image;
                    }
                );
            });
        });
    }

    public async updateImageStatus(
        id: number,
        newStatus: _ImageStatus_Values,
        byUserID: number
    ): Promise<Image> {
        const currentTime = this.timer.getCurrentTime();
        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImage(id);
            if (image === null) {
                this.logger.error("image with image_id not found", {
                    imageID: id,
                });
                throw new ErrorWithStatus(
                    `image with image_id ${id} not found`,
                    status.NOT_FOUND
                );
            }

            if (!this.isValidStatusChange(image.status, newStatus)) {
                this.logger.error("invalid status change", {
                    oldStatus: image.status,
                    newStatus: newStatus,
                });
                throw new ErrorWithStatus(
                    "invalid status change",
                    status.FAILED_PRECONDITION
                );
            }

            image.status = newStatus;
            if (newStatus === _ImageStatus_Values.PUBLISHED) {
                image.publishedByUserID = byUserID;
                image.publishTime = currentTime;
            }
            if (newStatus === _ImageStatus_Values.VERIFIED) {
                image.verifiedByUserID = byUserID;
                image.verifiedByUserID = currentTime;
            }

            await imageDM.updateImage({
                id: id,
                publishedByUserID: image.publishedByUserID,
                publishTime: image.publishTime,
                verifiedByUserID: image.verifiedByUserID,
                verifyTime: image.verifyTime,
                description: image.description,
                imageTypeID:
                    image.imageType === null ? null : image.imageType.id,
                status: newStatus,
            });

            return image;
        });
    }

    public isValidStatusChange(
        oldStatus: _ImageStatus_Values,
        newStatus: _ImageStatus_Values
    ): boolean {
        switch (oldStatus) {
            case _ImageStatus_Values.UPLOADED:
                return (
                    newStatus === _ImageStatus_Values.EXCLUDED ||
                    newStatus === _ImageStatus_Values.PUBLISHED
                );
            case _ImageStatus_Values.EXCLUDED:
                return newStatus === _ImageStatus_Values.UPLOADED;
            case _ImageStatus_Values.PUBLISHED:
                return newStatus === _ImageStatus_Values.VERIFIED;
            default:
                return false;
        }
    }

    public async updateImageListImageType(
        idList: number[],
        imageTypeID: number
    ): Promise<void> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeID);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeID,
            });
            throw new ErrorWithStatus(
                `image type with image_type_id ${imageTypeID} not found`,
                status.NOT_FOUND
            );
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            return this.regionDM.withTransaction(async (regionDM) => {
                return this.imageHasImageTagDM.withTransaction(
                    async (imageHasImageTagDM) => {
                        for (const imageID of idList) {
                            const image = await imageDM.getImageWithXLock(
                                imageID
                            );
                            if (image === null) {
                                this.logger.error(
                                    "image with image_id not found",
                                    { imageID }
                                );
                                throw new ErrorWithStatus(
                                    `image with image_id ${imageID} not found`,
                                    status.NOT_FOUND
                                );
                            }
                            await regionDM.updateLabelOfRegionOfImage(
                                imageID,
                                null
                            );
                            await imageHasImageTagDM.deleteImageHasImageTagOfImage(
                                imageID
                            );
                            image.imageType = imageType;
                            await imageDM.updateImage({
                                id: imageID,
                                publishedByUserID: image.publishedByUserID,
                                publishTime: image.publishTime,
                                verifiedByUserID: image.verifiedByUserID,
                                verifyTime: image.verifyTime,
                                description: image.description,
                                imageTypeID: imageTypeID,
                                status: image.status,
                            });
                        }
                    }
                );
            });
        });
    }

    public async deleteImage(id: number): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async deleteImageList(idList: number[]): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async addImageTagToImage(
        imageID: number,
        imageTagID: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async removeImageTagFromImage(
        imageID: number,
        imageTagID: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
