import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { join } from "path";
import validator from "validator";
import { Logger } from "winston";
import { ApplicationConfig, APPLICATION_CONFIG_TOKEN } from "../../config";
import {
    ImageDataAccessor,
    ImageHasImageTagDataAccessor,
    ImageType,
    ImageTypeDataAccessor,
    RegionDataAccessor,
    ImageListFilterOptions as DMImageListFilterOptions,
    ImageListSortOrder,
    ImageTagDataAccessor,
    ImageTagGroupDataAccessor,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    REGION_DATA_ACCESSOR_TOKEN,
    ImageTagGroupHasImageTypeDataAccessor,
    RegionSnapshotDataAccessor,
    Region as DMRegion,
    REGION_SNAPSHOT_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { Image } from "../../proto/gen/Image";
import { ImageListFilterOptions } from "../../proto/gen/ImageListFilterOptions";
import { _ImageListSortOrder_Values } from "../../proto/gen/ImageListSortOrder";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { ImageTag } from "../../proto/gen/ImageTag";
import { Region } from "../../proto/gen/Region";
import {
    ErrorWithStatus,
    IdGenerator,
    Id_GENERATOR_TOKEN,
    LOGGER_TOKEN,
    Timer,
    TIMER_TOKEN,
} from "../../utils";
import { ImageProcessor, IMAGE_PROCESSOR_TOKEN } from "./image_processor";

export interface ImageManagementOperator {
    createImage(
        uploadedByUserId: number,
        originalFileName: string,
        imageData: Buffer,
        description: string | undefined,
        imageTypeId: number | undefined,
        imageTagIdList: number[]
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
        filterOptions: ImageListFilterOptions | undefined,
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
    updateImageImageType(id: number, imageTypeId: number): Promise<Image>;
    updateImageStatus(
        id: number,
        status: _ImageStatus_Values,
        byUserId: number
    ): Promise<Image>;
    updateImageListImageType(
        idList: number[],
        imageTypeId: number
    ): Promise<void>;
    deleteImage(id: number): Promise<void>;
    deleteImageList(idList: number[]): Promise<void>;
    addImageTagToImage(imageId: number, imageTagId: number): Promise<void>;
    removeImageTagFromImage(imageId: number, imageTagId: number): Promise<void>;
    getRegionSnapshotListOfImage(
        ofImageId: number,
        atStatus: _ImageStatus_Values
    ): Promise<Region[]>;
}

const ORIGINAL_WIDTH = 1920;
const ORIGINAL_HEIGHT = 1080;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;

export class ImageManagementOperatorImpl implements ImageManagementOperator {
    constructor(
        private readonly imageDM: ImageDataAccessor,
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly imageTagGroupDM: ImageTagGroupDataAccessor,
        private readonly imageTagDM: ImageTagDataAccessor,
        private readonly imageTagGroupHasImageTypeDM: ImageTagGroupHasImageTypeDataAccessor,
        private readonly imageHasImageTagDM: ImageHasImageTagDataAccessor,
        private readonly regionDM: RegionDataAccessor,
        private readonly regionSnapshotDM: RegionSnapshotDataAccessor,
        private readonly idGenerator: IdGenerator,
        private readonly timer: Timer,
        private readonly imageProcessor: ImageProcessor,
        private readonly applicationConfig: ApplicationConfig,
        private readonly logger: Logger
    ) {}

    public async createImage(
        uploadedByUserId: number,
        originalFileName: string,
        imageData: Buffer,
        description: string,
        imageTypeId: number | undefined,
        imageTagIdList: number[]
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
        if (imageTypeId !== undefined) {
            imageType = await this.imageTypeDM.getImageType(imageTypeId);
            if (imageType === null) {
                this.logger.error("image type with image_type_id not found", {
                    imageTypeId,
                });
                throw new ErrorWithStatus(
                    `image type with image_type_id ${imageTypeId} not found`,
                    status.NOT_FOUND
                );
            }
        }

        if (imageTagIdList.length > 0) {
            if (imageType === null) {
                this.logger.error(
                    "no image type provided, but a list of image tag list is requested to be added to the image"
                );
                throw new ErrorWithStatus(
                    "no image type provided, but a list of image tag list is requested to be added to the image",
                    status.FAILED_PRECONDITION
                );
            }
            if (
                !this.isImageTagListValidForImageType(
                    imageType.id,
                    imageTagIdList
                )
            ) {
                this.logger.error(
                    "one or more items of the image tag Id list is incompatible with the image type",
                    { imageTypeId, imageTagIdList }
                );
                throw new ErrorWithStatus(
                    "one or more items of the image tag Id list is incompatible with the image type",
                    status.FAILED_PRECONDITION
                );
            }
        }

        const uploadTime = this.timer.getCurrentTime();
        const originalImageFileName = await this.generateOriginalImageFilename(
            uploadTime
        );
        const thumbnailImageFileName =
            await this.generateThumbnailImageFilename(uploadTime);
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

        const uploadedImageId = await this.imageDM.createImage({
            uploadedByUserId: uploadedByUserId,
            uploadTime: uploadTime,
            publishedByUserId: 0,
            publishTime: 0,
            verifiedByUserId: 0,
            verifyTime: 0,
            originalFileName: originalFileName,
            originalImageFilename: originalImageFileName,
            thumbnailImageFilename: thumbnailImageFileName,
            description: description,
            imageTypeId: imageTypeId === undefined ? null : imageTypeId,
            status: _ImageStatus_Values.UPLOADED,
        });

        return this.imageHasImageTagDM.withTransaction(
            async (imageHasImageTagDM) => {
                for (const imageTagId of imageTagIdList) {
                    await imageHasImageTagDM.createImageHasImageTag(
                        uploadedImageId,
                        imageTagId
                    );
                }

                return {
                    id: uploadedImageId,
                    uploadedByUserId: uploadedByUserId,
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
        );
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

    private async generateOriginalImageFilename(
        uploadTime: number
    ): Promise<string> {
        return `original-${uploadTime}-${await this.idGenerator.generate()}.jpeg`;
    }

    private async generateThumbnailImageFilename(
        uploadTime: number
    ): Promise<string> {
        return `thumbnail-${uploadTime}-${await this.idGenerator.generate()}.jpeg`;
    }

    private async isImageTagListValidForImageType(
        imageTypeId: number,
        imageTagIdList: number[]
    ): Promise<boolean> {
        const imageTagGroupList =
            await this.imageTagGroupHasImageTypeDM.getImageTagGroupOfImageType(
                imageTypeId
            );
        const imageTagGroupIdList = imageTagGroupList.map(
            (imageTagGroup) => imageTagGroup.id
        );
        const imageTagList =
            await this.imageTagDM.getImageTagListOfImageTagGroupIdList(
                imageTagGroupIdList
            );

        const validImageTagIdSet = new Set<number>();
        for (const imageTagSublist of imageTagList) {
            for (const imageTag of imageTagSublist) {
                validImageTagIdSet.add(imageTag.id);
            }
        }

        for (const imageTagId of imageTagIdList) {
            if (!validImageTagIdSet.has(imageTagId)) {
                return false;
            }
        }
        return true;
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
            this.logger.error("no image with image_id found", { imageId: id });
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
        filterOptions: ImageListFilterOptions | undefined,
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
        const imageIdList = imageList.map((image) => image.id);

        let imageTagList: ImageTag[][] | undefined = undefined;
        if (withImageTag) {
            imageTagList =
                await this.imageHasImageTagDM.getImageTagListOfImageList(
                    imageIdList
                );
        }

        let regionList: Region[][] | undefined = undefined;
        if (withRegion) {
            regionList = await this.regionDM.getRegionListOfImageList(
                imageIdList
            );
        }

        return { totalImageCount, imageList, imageTagList, regionList };
    }

    private async getDMImageListFilterOptions(
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<DMImageListFilterOptions> {
        const dmFilterOptions = new DMImageListFilterOptions();
        if (filterOptions === undefined) {
            return dmFilterOptions;
        }

        dmFilterOptions.uploadedByUserIdList =
            filterOptions.uploadedByUserIdList || [];
        dmFilterOptions.uploadTimeStart = +(filterOptions.uploadTimeStart || 0);
        dmFilterOptions.uploadTimeEnd = +(filterOptions.uploadTimeEnd || 0);

        dmFilterOptions.publishedByUserIdList =
            filterOptions.publishedByUserIdList || [];
        dmFilterOptions.publishTimeStart = +(
            filterOptions.publishTimeStart || 0
        );
        dmFilterOptions.publishTimeEnd = +(filterOptions.publishTimeEnd || 0);

        dmFilterOptions.verifiedByUserIdList =
            filterOptions.verifiedByUserIdList || [];
        dmFilterOptions.verifyTimeStart = +(filterOptions.verifyTimeStart || 0);
        dmFilterOptions.verifyTimeEnd = +(filterOptions.verifyTimeEnd || 0);

        dmFilterOptions.imageTypeIdList = filterOptions.imageTypeIdList || [];
        dmFilterOptions.originalFileNameQuery =
            filterOptions.originalFileNameQuery || "";
        dmFilterOptions.imageStatusList = filterOptions.imageStatusList || [];

        const imageIdSet = new Set<number>();
        if (
            filterOptions.imageTagIdList !== undefined &&
            filterOptions.imageTagIdList.length > 0
        ) {
            const imageIdList =
                await this.imageHasImageTagDM.getImageIdListOfImageTagList(
                    filterOptions.imageTagIdList
                );
            for (const imageId of imageIdList) {
                imageIdSet.add(imageId);
            }
        }
        if (
            filterOptions.regionLabelIdList !== undefined &&
            filterOptions.regionLabelIdList.length > 0
        ) {
            const imageIdList =
                await this.regionDM.getOfImageIdListOfRegionLabelList(
                    filterOptions.regionLabelIdList
                );
            for (const imageId of imageIdList) {
                imageIdSet.add(imageId);
            }
        }
        dmFilterOptions.imageIdList = Array.from(imageIdSet);

        return dmFilterOptions;
    }

    private getImageListSortOrder(
        sortOrder: _ImageListSortOrder_Values
    ): ImageListSortOrder {
        switch (sortOrder) {
            case _ImageListSortOrder_Values.ID_ASCENDING:
                return ImageListSortOrder.Id_ASCENDING;
            case _ImageListSortOrder_Values.ID_DESCENDING:
                return ImageListSortOrder.Id_DESCENDING;
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
                    imageId: id,
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
                publishedByUserId: image.publishedByUserId,
                publishTime: image.publishTime,
                verifiedByUserId: image.verifiedByUserId,
                verifyTime: image.verifyTime,
                description: image.description,
                imageTypeId:
                    image.imageType === null ? null : image.imageType.id,
                status: image.status,
            });
            return image;
        });
    }

    public async updateImageImageType(
        id: number,
        imageTypeId: number
    ): Promise<Image> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `image type with image_type_id ${imageTypeId} not found`,
                status.NOT_FOUND
            );
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImageWithXLock(id);
            if (image === null) {
                this.logger.error("image with image_id not found", {
                    imageId: id,
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
                            publishedByUserId: image.publishedByUserId,
                            publishTime: image.publishTime,
                            verifiedByUserId: image.verifiedByUserId,
                            verifyTime: image.verifyTime,
                            description: image.description,
                            imageTypeId: imageTypeId,
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
        byUserId: number
    ): Promise<Image> {
        const currentTime = this.timer.getCurrentTime();
        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImage(id);
            if (image === null) {
                this.logger.error("image with image_id not found", {
                    imageId: id,
                });
                throw new ErrorWithStatus(
                    `image with image_id ${id} not found`,
                    status.NOT_FOUND
                );
            }

            if (!this.isValidStatusTransition(image.status, newStatus)) {
                this.logger.error("invalid status transition", {
                    oldStatus: image.status,
                    newStatus: newStatus,
                });
                throw new ErrorWithStatus(
                    "invalid status transition",
                    status.FAILED_PRECONDITION
                );
            }

            const regionListOfImage = await this.regionDM.getRegionListOfImage(
                id
            );
            if (newStatus === _ImageStatus_Values.PUBLISHED) {
                for (const region of regionListOfImage) {
                    if (region.label === null) {
                        this.logger.error(
                            "there are unlabeled regions, image cannot be published",
                            { imageId: id }
                        );
                        throw new ErrorWithStatus(
                            "there are unlabeled regions, image cannot be published",
                            status.FAILED_PRECONDITION
                        );
                    }
                }
            }

            return this.regionSnapshotDM.withTransaction(
                async (regionSnapshotDM) => {
                    image.status = newStatus;
                    if (newStatus === _ImageStatus_Values.PUBLISHED) {
                        image.publishedByUserId = byUserId;
                        image.publishTime = currentTime;
                        await this.generateRegionSnapshotOfImage(
                            regionSnapshotDM,
                            newStatus,
                            regionListOfImage
                        );
                    }
                    if (newStatus === _ImageStatus_Values.VERIFIED) {
                        image.verifiedByUserId = byUserId;
                        image.verifiedByUserId = currentTime;
                        await this.generateRegionSnapshotOfImage(
                            regionSnapshotDM,
                            newStatus,
                            regionListOfImage
                        );
                    }

                    await imageDM.updateImage({
                        id: id,
                        publishedByUserId: image.publishedByUserId,
                        publishTime: image.publishTime,
                        verifiedByUserId: image.verifiedByUserId,
                        verifyTime: image.verifyTime,
                        description: image.description,
                        imageTypeId:
                            image.imageType === null
                                ? null
                                : image.imageType.id,
                        status: newStatus,
                    });

                    return image;
                }
            );
        });
    }

    private isValidStatusTransition(
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

    private async generateRegionSnapshotOfImage(
        regionSnapshotDM: RegionSnapshotDataAccessor,
        status: _ImageStatus_Values,
        regionListOfImage: DMRegion[]
    ): Promise<void> {
        for (const region of regionListOfImage) {
            await regionSnapshotDM.createRegionSnapshot({
                ofImageId: region.ofImageId,
                atStatus: status,
                drawnByUserId: region.drawnByUserId,
                labeledByUserId: region.labeledByUserId,
                border: region.border,
                holes: region.holes,
                labelId: region.label === null ? null : region.label.id,
            });
        }
    }

    public async updateImageListImageType(
        idList: number[],
        imageTypeId: number
    ): Promise<void> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `image type with image_type_id ${imageTypeId} not found`,
                status.NOT_FOUND
            );
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            return this.regionDM.withTransaction(async (regionDM) => {
                return this.imageHasImageTagDM.withTransaction(
                    async (imageHasImageTagDM) => {
                        for (const imageId of idList) {
                            const image = await imageDM.getImageWithXLock(
                                imageId
                            );
                            if (image === null) {
                                this.logger.error(
                                    "image with image_id not found",
                                    { imageId }
                                );
                                throw new ErrorWithStatus(
                                    `image with image_id ${imageId} not found`,
                                    status.NOT_FOUND
                                );
                            }
                            await regionDM.updateLabelOfRegionOfImage(
                                imageId,
                                null
                            );
                            await imageHasImageTagDM.deleteImageHasImageTagOfImage(
                                imageId
                            );
                            image.imageType = imageType;
                            await imageDM.updateImage({
                                id: imageId,
                                publishedByUserId: image.publishedByUserId,
                                publishTime: image.publishTime,
                                verifiedByUserId: image.verifiedByUserId,
                                verifyTime: image.verifyTime,
                                description: image.description,
                                imageTypeId: imageTypeId,
                                status: image.status,
                            });
                        }
                    }
                );
            });
        });
    }

    public async deleteImage(id: number): Promise<void> {
        return this.imageDM.deleteImage(id);
    }

    public async deleteImageList(idList: number[]): Promise<void> {
        return this.imageDM.deleteImageList(idList);
    }

    public async addImageTagToImage(
        imageId: number,
        imageTagId: number
    ): Promise<void> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("image with image_id not found", { imageId });
            throw new ErrorWithStatus(
                `image with image_id ${imageId} not found`,
                status.NOT_FOUND
            );
        }
        if (image.imageType === null) {
            this.logger.error(
                "image does not have image type, cannot assign tag",
                { imageId }
            );
            throw new ErrorWithStatus(
                `image does not have image type, cannot assign tag`,
                status.FAILED_PRECONDITION
            );
        }

        const imageTag = await this.imageTagDM.getImageTag(imageTagId);
        if (imageTag === null) {
            this.logger.error("image tag with image_tag_id not found", {
                imageTagId,
            });
            throw new ErrorWithStatus(
                `image tag with image_tag_id ${imageTagId} not found`,
                status.NOT_FOUND
            );
        }

        const imageTagListOfImage = (
            await this.imageHasImageTagDM.getImageTagListOfImageList([imageId])
        )[0];
        const imageAlreadyHasTag =
            imageTagListOfImage.find((item) => item.id === imageTag.id) !==
            undefined;
        if (imageAlreadyHasTag) {
            this.logger.error("image already has image tag", {
                imageId,
                imageTagId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${imageId} already has image tag with image_tag_id ${imageTagId}`,
                status.FAILED_PRECONDITION
            );
        }

        const imageTagGroupId = imageTag.ofImageTagGroupId;
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            imageTagGroupId
        );
        if (imageTagGroup?.isSingleValue) {
            for (const item of imageTagListOfImage) {
                if (item.ofImageTagGroupId === imageTagGroupId) {
                    this.logger.error(
                        "image with image_id already has tag of image tag group with image_tag_group_id",
                        { imageId, imageTagGroupId }
                    );
                    throw new ErrorWithStatus(
                        `image with image_id ${imageId} already has tag of image tag group with image_tag_group_id ${imageTagGroupId}`,
                        status.FAILED_PRECONDITION
                    );
                }
            }
        }

        const imageTypeId = image.imageType.id;
        const imageTagGroupHasImageTypeRelation =
            await this.imageTagGroupHasImageTypeDM.getImageTagGroupHasImageType(
                imageTagGroupId,
                imageTypeId
            );
        if (imageTagGroupHasImageTypeRelation === null) {
            this.logger.error("image tag group does not have image type", {
                imageTagGroupId,
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `image tag group ${imageTagGroupId} does not have image type ${imageTypeId}`,
                status.FAILED_PRECONDITION
            );
        }

        await this.imageHasImageTagDM.createImageHasImageTag(
            imageId,
            imageTagId
        );
    }

    public async removeImageTagFromImage(
        imageId: number,
        imageTagId: number
    ): Promise<void> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("image with image_id not found", { imageId });
            throw new ErrorWithStatus(
                `image with image_id ${imageId} not found`,
                status.NOT_FOUND
            );
        }
        if (image.imageType === null) {
            this.logger.error(
                "image does not have image type, cannot assign tag",
                { imageId }
            );
            throw new ErrorWithStatus(
                `image does not have image type, cannot assign tag`,
                status.FAILED_PRECONDITION
            );
        }

        const imageTag = await this.imageTagDM.getImageTag(imageTagId);
        if (imageTag === null) {
            this.logger.error("image tag with image_tag_id not found", {
                imageTagId,
            });
            throw new ErrorWithStatus(
                `image tag with image_tag_id ${imageTagId} not found`,
                status.NOT_FOUND
            );
        }

        const imageTagListOfImage = (
            await this.imageHasImageTagDM.getImageTagListOfImageList([imageId])
        )[0];
        const imageAlreadyHasTag =
            imageTagListOfImage.find((item) => item.id === imageTag.id) !==
            undefined;
        if (!imageAlreadyHasTag) {
            this.logger.error("image does not have image tag", {
                imageId,
                imageTagId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${imageId} does not have image tag with image_tag_id ${imageTagId}`,
                status.FAILED_PRECONDITION
            );
        }

        await this.imageHasImageTagDM.deleteImageHasImageTag(
            imageId,
            imageTagId
        );
    }

    public async getRegionSnapshotListOfImage(
        ofImageId: number,
        atStatus: _ImageStatus_Values
    ): Promise<Region[]> {
        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(
                `image with image_id ${ofImageId} not found`,
                status.NOT_FOUND
            );
        }

        return await this.regionSnapshotDM.getRegionSnapshotListOfImage(
            ofImageId,
            atStatus
        );
    }
}

injected(
    ImageManagementOperatorImpl,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    REGION_DATA_ACCESSOR_TOKEN,
    REGION_SNAPSHOT_DATA_ACCESSOR_TOKEN,
    Id_GENERATOR_TOKEN,
    TIMER_TOKEN,
    IMAGE_PROCESSOR_TOKEN,
    APPLICATION_CONFIG_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_MANAGEMENT_OPERATOR_TOKEN = token<ImageManagementOperator>(
    "ImageManagementOperator"
);
