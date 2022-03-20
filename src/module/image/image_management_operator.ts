import { status } from "@grpc/grpc-js";
import { join } from "path";
import validator from "validator";
import { Logger } from "winston";
import { ApplicationConfig } from "../../config";
import {
    ImageDataAccessor,
    ImageHasImageTagDataAccessor,
    ImageStatus,
    ImageType,
    ImageTypeDataAccessor,
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
    updateImageStatus(id: number, status: _ImageStatus_Values): Promise<Image>;
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
            status: ImageStatus.UPLOADED,
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
        throw new Error("Method not implemented.");
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
        throw new Error("Method not implemented.");
    }

    public async updateImageMetadata(
        id: number,
        description: string | undefined
    ): Promise<Image> {
        throw new Error("Method not implemented.");
    }

    public async updateImageImageType(
        id: number,
        imageTypeID: number
    ): Promise<Image> {
        throw new Error("Method not implemented.");
    }

    public async updateImageStatus(
        id: number,
        status: _ImageStatus_Values
    ): Promise<Image> {
        throw new Error("Method not implemented.");
    }

    public async updateImageListImageType(
        idList: number[],
        imageTypeID: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
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
