import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import validator from "validator";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    ImageHasImageTagDataAccessor,
    ImageType,
    ImageTypeDataAccessor,
    RegionDataAccessor,
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
import { ImageCreated, ImageCreatedProducer, IMAGE_CREATED_PRODUCER_TOKEN } from "../../dataaccess/kafka";
import { BucketDM, THUMBNAIL_IMAGE_DM_TOKEN, ORIGINAL_IMAGE_DM_TOKEN } from "../../dataaccess/s3";
import { Image } from "../../proto/gen/Image";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { ImageTag } from "../../proto/gen/ImageTag";
import { Region } from "../../proto/gen/Region";
import { ErrorWithStatus, IdGenerator, ID_GENERATOR_TOKEN, LOGGER_TOKEN, Timer, TIMER_TOKEN } from "../../utils";
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
    updateImageMetadata(id: number, description: string | undefined): Promise<Image>;
    updateImageImageType(id: number, imageTypeId: number): Promise<Image>;
    updateImageStatus(id: number, status: _ImageStatus_Values, byUserId: number): Promise<Image>;
    deleteImage(id: number): Promise<void>;
    addImageTagToImage(imageId: number, imageTagId: number): Promise<void>;
    removeImageTagFromImage(imageId: number, imageTagId: number): Promise<void>;
    getRegionSnapshotListOfImage(ofImageId: number, atStatus: _ImageStatus_Values): Promise<Region[]>;
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
        private readonly imageCreatedProducer: ImageCreatedProducer,
        private readonly originalImageS3DM: BucketDM,
        private readonly thumbnailImageS3DM: BucketDM,
        private readonly idGenerator: IdGenerator,
        private readonly timer: Timer,
        private readonly imageProcessor: ImageProcessor,
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
            throw new ErrorWithStatus(`invalid original file name ${originalFileName}`, status.INVALID_ARGUMENT);
        }

        description = this.sanitizeDescription(description);

        let imageType: ImageType | null = null;
        if (imageTypeId !== undefined) {
            imageType = await this.imageTypeDM.getImageType(imageTypeId);
            if (imageType === null) {
                this.logger.error("image type with image_type_id not found", {
                    imageTypeId,
                });
                throw new ErrorWithStatus(`image type with image_type_id ${imageTypeId} not found`, status.NOT_FOUND);
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
            if (!this.isImageTagListValidForImageType(imageType.id, imageTagIdList)) {
                this.logger.error("one or more items of the image tag Id list is incompatible with the image type", {
                    imageTypeId,
                    imageTagIdList,
                });
                throw new ErrorWithStatus(
                    "one or more items of the image tag Id list is incompatible with the image type",
                    status.FAILED_PRECONDITION
                );
            }
        }

        const uploadTime = this.timer.getCurrentTime();
        const originalImageFileName = await this.generateOriginalImageFilename(uploadTime);
        const thumbnailImageFileName = await this.generateThumbnailImageFilename(uploadTime);

        try {
            Promise.all([
                this.imageProcessor
                    .resizeImage(imageData, ORIGINAL_WIDTH, ORIGINAL_HEIGHT)
                    .then((resizedBuffer) => this.originalImageS3DM.uploadFile(originalImageFileName, resizedBuffer)),
                this.imageProcessor
                    .resizeImage(imageData, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
                    .then((resizedBuffer) => this.thumbnailImageS3DM.uploadFile(thumbnailImageFileName, resizedBuffer)),
            ]);
        } catch (error) {
            this.logger.error("failed to save image files", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }

        const uploadedImage = await this.imageDM.withTransaction(async (imageDM) => {
            const uploadedImageId = await imageDM.createImage({
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
        });

        await this.imageHasImageTagDM.withTransaction(async (imageHasImageTagDM) => {
            for (const imageTagId of imageTagIdList) {
                await imageHasImageTagDM.createImageHasImageTag(uploadedImage.id, imageTagId);
            }
        });

        await this.imageCreatedProducer.createImageCreatedMessage(new ImageCreated(uploadedImage));

        return uploadedImage;
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

    private async generateOriginalImageFilename(uploadTime: number): Promise<string> {
        return `original-${uploadTime}-${await this.idGenerator.generate()}.jpeg`;
    }

    private async generateThumbnailImageFilename(uploadTime: number): Promise<string> {
        return `thumbnail-${uploadTime}-${await this.idGenerator.generate()}.jpeg`;
    }

    private async isImageTagListValidForImageType(imageTypeId: number, imageTagIdList: number[]): Promise<boolean> {
        const imageTagGroupList = await this.imageTagGroupHasImageTypeDM.getImageTagGroupOfImageType(imageTypeId);
        const imageTagGroupIdList = imageTagGroupList.map((imageTagGroup) => imageTagGroup.id);
        const imageTagList = await this.imageTagDM.getImageTagListOfImageTagGroupIdList(imageTagGroupIdList);

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
            throw new ErrorWithStatus(`no image with image_id ${id} found`, status.NOT_FOUND);
        }

        let imageTagList: ImageTag[] | undefined = undefined;
        if (withImageTag) {
            imageTagList = (await this.imageHasImageTagDM.getImageTagListOfImageList([id]))[0];
        }

        let regionList: Region[] | undefined = undefined;
        if (withRegion) {
            regionList = await this.regionDM.getRegionListOfImage(id);
        }

        return { image, imageTagList, regionList };
    }

    public async updateImageMetadata(id: number, description: string | undefined): Promise<Image> {
        if (description !== undefined) {
            description = this.sanitizeDescription(description);
        }
        return this.imageDM.withTransaction(async (dm) => {
            const image = await dm.getImage(id);
            if (image === null) {
                this.logger.error("no image with image_id found", {
                    imageId: id,
                });
                throw new ErrorWithStatus(`no image with image_id ${id} found`, status.NOT_FOUND);
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
                imageTypeId: image.imageType === null ? null : image.imageType.id,
                status: image.status,
            });
            return image;
        });
    }

    public async updateImageImageType(id: number, imageTypeId: number): Promise<Image> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(`image type with image_type_id ${imageTypeId} not found`, status.NOT_FOUND);
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImageWithXLock(id);
            if (image === null) {
                this.logger.error("image with image_id not found", {
                    imageId: id,
                });
                throw new ErrorWithStatus(`image with image_id ${id} not found`, status.NOT_FOUND);
            }

            return this.regionDM.withTransaction(async (regionDM) => {
                await regionDM.updateLabelOfRegionOfImage(id, null);

                return this.imageHasImageTagDM.withTransaction(async (imageHasImageTagDM) => {
                    await imageHasImageTagDM.deleteImageHasImageTagOfImage(id);

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
                });
            });
        });
    }

    public async updateImageStatus(id: number, newStatus: _ImageStatus_Values, byUserId: number): Promise<Image> {
        const currentTime = this.timer.getCurrentTime();
        return this.imageDM.withTransaction(async (imageDM) => {
            const image = await imageDM.getImage(id);
            if (image === null) {
                this.logger.error("image with image_id not found", { imageId: id });
                throw new ErrorWithStatus(`image with image_id ${id} not found`, status.NOT_FOUND);
            }

            const oldStatus = image.status;
            if (!this.isValidStatusTransition(oldStatus, newStatus)) {
                this.logger.error("invalid status transition", { oldStatus, newStatus });
                throw new ErrorWithStatus("invalid status transition", status.FAILED_PRECONDITION);
            }

            const regionListOfImage = await this.regionDM.getRegionListOfImage(id);
            if (oldStatus === _ImageStatus_Values.UPLOADED && newStatus === _ImageStatus_Values.PUBLISHED) {
                if (this.regionListHasUnlabeledRegion(regionListOfImage)) {
                    this.logger.error("cannot publish image with unlabeled regions");
                    throw new ErrorWithStatus("invalid status transition", status.FAILED_PRECONDITION);
                }
            }

            return this.regionSnapshotDM.withTransaction(async (regionSnapshotDM) => {
                if (this.isDowngradingStatusTransition(oldStatus, newStatus)) {
                    await regionSnapshotDM.deleteRegionSnapshotListOfImageAtStatus(id, oldStatus);
                }

                image.status = newStatus;
                if (newStatus === _ImageStatus_Values.PUBLISHED) {
                    image.publishedByUserId = byUserId;
                    image.publishTime = currentTime;
                    image.verifiedByUserId = 0;
                    image.publishTime = 0;
                    await this.generateRegionSnapshotOfImage(regionSnapshotDM, newStatus, regionListOfImage);
                }
                if (newStatus === _ImageStatus_Values.VERIFIED) {
                    image.verifiedByUserId = byUserId;
                    image.verifyTime = currentTime;
                    await this.generateRegionSnapshotOfImage(regionSnapshotDM, newStatus, regionListOfImage);
                }

                await imageDM.updateImage({
                    id: id,
                    publishedByUserId: image.publishedByUserId,
                    publishTime: image.publishTime,
                    verifiedByUserId: image.verifiedByUserId,
                    verifyTime: image.verifyTime,
                    description: image.description,
                    imageTypeId: image.imageType === null ? null : image.imageType.id,
                    status: newStatus,
                });

                // HACK: since we can't get image type with x lock, need to manually retrieve image type here
                if (image.imageType !== null) {
                    image.imageType = await this.imageTypeDM.getImageType(image.imageType.id);
                }

                return image;
            });
        });
    }

    private isValidStatusTransition(oldStatus: _ImageStatus_Values, newStatus: _ImageStatus_Values): boolean {
        switch (oldStatus) {
            case _ImageStatus_Values.UPLOADED:
                return newStatus === _ImageStatus_Values.EXCLUDED || newStatus === _ImageStatus_Values.PUBLISHED;
            case _ImageStatus_Values.PUBLISHED:
                return (
                    newStatus === _ImageStatus_Values.UPLOADED ||
                    newStatus == _ImageStatus_Values.EXCLUDED ||
                    newStatus === _ImageStatus_Values.VERIFIED
                );
            case _ImageStatus_Values.VERIFIED:
                return newStatus === _ImageStatus_Values.PUBLISHED;
            case _ImageStatus_Values.EXCLUDED:
                return newStatus === _ImageStatus_Values.UPLOADED;
            default:
                return false;
        }
    }

    private isDowngradingStatusTransition(oldStatus: _ImageStatus_Values, newStatus: _ImageStatus_Values): boolean {
        switch (oldStatus) {
            case _ImageStatus_Values.VERIFIED:
                return newStatus === _ImageStatus_Values.PUBLISHED;
            case _ImageStatus_Values.PUBLISHED:
                return newStatus === _ImageStatus_Values.UPLOADED || newStatus == _ImageStatus_Values.EXCLUDED;
            default:
                return false;
        }
    }

    private regionListHasUnlabeledRegion(regionList: DMRegion[]): boolean {
        return regionList.find((region) => region.label === null) !== undefined;
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

    public async deleteImage(id: number): Promise<void> {
        return this.imageDM.deleteImage(id);
    }

    public async addImageTagToImage(imageId: number, imageTagId: number): Promise<void> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("image with image_id not found", { imageId });
            throw new ErrorWithStatus(`image with image_id ${imageId} not found`, status.NOT_FOUND);
        }
        if (image.imageType === null) {
            this.logger.error("image does not have image type, cannot assign tag", { imageId });
            throw new ErrorWithStatus(`image does not have image type, cannot assign tag`, status.FAILED_PRECONDITION);
        }

        const imageTag = await this.imageTagDM.getImageTag(imageTagId);
        if (imageTag === null) {
            this.logger.error("image tag with image_tag_id not found", {
                imageTagId,
            });
            throw new ErrorWithStatus(`image tag with image_tag_id ${imageTagId} not found`, status.NOT_FOUND);
        }

        const imageTagListOfImage = (await this.imageHasImageTagDM.getImageTagListOfImageList([imageId]))[0];
        const imageAlreadyHasTag = imageTagListOfImage.find((item) => item.id === imageTag.id) !== undefined;
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
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(imageTagGroupId);
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
        const imageTagGroupHasImageTypeRelation = await this.imageTagGroupHasImageTypeDM.getImageTagGroupHasImageType(
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

        await this.imageHasImageTagDM.createImageHasImageTag(imageId, imageTagId);
    }

    public async removeImageTagFromImage(imageId: number, imageTagId: number): Promise<void> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("image with image_id not found", { imageId });
            throw new ErrorWithStatus(`image with image_id ${imageId} not found`, status.NOT_FOUND);
        }
        if (image.imageType === null) {
            this.logger.error("image does not have image type, cannot assign tag", { imageId });
            throw new ErrorWithStatus(`image does not have image type, cannot assign tag`, status.FAILED_PRECONDITION);
        }

        const imageTag = await this.imageTagDM.getImageTag(imageTagId);
        if (imageTag === null) {
            this.logger.error("image tag with image_tag_id not found", {
                imageTagId,
            });
            throw new ErrorWithStatus(`image tag with image_tag_id ${imageTagId} not found`, status.NOT_FOUND);
        }

        const imageTagListOfImage = (await this.imageHasImageTagDM.getImageTagListOfImageList([imageId]))[0];
        const imageAlreadyHasTag = imageTagListOfImage.find((item) => item.id === imageTag.id) !== undefined;
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

        await this.imageHasImageTagDM.deleteImageHasImageTag(imageId, imageTagId);
    }

    public async getRegionSnapshotListOfImage(ofImageId: number, atStatus: _ImageStatus_Values): Promise<Region[]> {
        const image = await this.imageDM.getImage(ofImageId);
        if (image === null) {
            this.logger.error("image with image_id not found", {
                imageId: ofImageId,
            });
            throw new ErrorWithStatus(`image with image_id ${ofImageId} not found`, status.NOT_FOUND);
        }

        return await this.regionSnapshotDM.getRegionSnapshotListOfImageAtStatus(ofImageId, atStatus);
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
    IMAGE_CREATED_PRODUCER_TOKEN,
    ORIGINAL_IMAGE_DM_TOKEN,
    THUMBNAIL_IMAGE_DM_TOKEN,
    ID_GENERATOR_TOKEN,
    TIMER_TOKEN,
    IMAGE_PROCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_MANAGEMENT_OPERATOR_TOKEN = token<ImageManagementOperator>("ImageManagementOperator");
