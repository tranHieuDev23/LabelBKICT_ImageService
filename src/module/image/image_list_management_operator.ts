import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    ImageHasImageTagDataAccessor,
    ImageTypeDataAccessor,
    RegionDataAccessor,
    ImageListFilterOptions as DMImageListFilterOptions,
    ImageListSortOrder as DMImageListSortOrder,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    REGION_DATA_ACCESSOR_TOKEN,
    UserBookmarksImageDataAccessor,
    USER_BOOKMARKS_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { Image } from "../../proto/gen/Image";
import { ImageListFilterOptions } from "../../proto/gen/ImageListFilterOptions";
import { _ImageListSortOrder_Values } from "../../proto/gen/ImageListSortOrder";
import { ImageTag } from "../../proto/gen/ImageTag";
import { Region } from "../../proto/gen/Region";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { AddImageTagToImageOperator, ADD_IMAGE_TAG_TO_IMAGE_OPERATOR_TOKEN } from "./add_image_tag_to_image_operator";

export interface ImageListManagementOperator {
    getImageList(
        offset: number,
        limit: number | undefined,
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
    getImageIdList(
        offset: number,
        limit: number | undefined,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<{
        totalImageCount: number;
        imageIdList: number[];
    }>;
    getImagePositionInList(
        id: number,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<{
        position: number;
        totalImageCount: number;
        prevImageId: number | undefined;
        nextImageId: number | undefined;
    }>;
    updateImageListImageType(idList: number[], imageTypeId: number): Promise<void>;
    deleteImageList(idList: number[]): Promise<void>;
    addImageTagListToImageList(imageIdList: number[], imageTagIdList: number[]): Promise<void>;
}

export class ImageListManagementOperatorImpl implements ImageListManagementOperator {
    constructor(
        private readonly addImageTagToImageOperator: AddImageTagToImageOperator,
        private readonly imageDM: ImageDataAccessor,
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly imageHasImageTagDM: ImageHasImageTagDataAccessor,
        private readonly regionDM: RegionDataAccessor,
        private readonly userBookmarksImageDM: UserBookmarksImageDataAccessor,
        private readonly logger: Logger
    ) {}

    public async getImageList(
        offset: number,
        limit: number | undefined,
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
        const dmFilterOptions = await this.getDMImageListFilterOptions(filterOptions);
        const totalImageCount = await this.imageDM.getImageCount(dmFilterOptions);
        const imageList = await this.imageDM.getImageList(
            offset,
            limit,
            this.getDMImageListSortOrder(sortOrder),
            dmFilterOptions
        );
        const imageIdList = imageList.map((image) => image.id);

        let imageTagList: ImageTag[][] | undefined = undefined;
        if (withImageTag) {
            imageTagList = await this.imageHasImageTagDM.getImageTagListOfImageList(imageIdList);
        }

        let regionList: Region[][] | undefined = undefined;
        if (withRegion) {
            regionList = await this.regionDM.getRegionListOfImageList(imageIdList);
        }

        return { totalImageCount, imageList, imageTagList, regionList };
    }

    public async getImageIdList(
        offset: number,
        limit: number | undefined,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<{
        totalImageCount: number;
        imageIdList: number[];
    }> {
        const dmFilterOptions = await this.getDMImageListFilterOptions(filterOptions);
        const totalImageCount = await this.imageDM.getImageCount(dmFilterOptions);
        const imageIdList = await this.imageDM.getImageIdList(
            offset,
            limit,
            this.getDMImageListSortOrder(sortOrder),
            dmFilterOptions
        );

        return { totalImageCount, imageIdList };
    }

    public async getImagePositionInList(
        id: number,
        sortOrder: _ImageListSortOrder_Values,
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<{
        position: number;
        totalImageCount: number;
        prevImageId: number | undefined;
        nextImageId: number | undefined;
    }> {
        const image = await this.imageDM.getImage(id);
        if (image === null) {
            this.logger.error("no image with image_id found", { imageId: id });
            throw new ErrorWithStatus(`no image with image_id ${id} found`, status.NOT_FOUND);
        }
        const dmSortOrder = this.getDMImageListSortOrder(sortOrder);
        const dmFilterOptions = await this.getDMImageListFilterOptions(filterOptions);
        const dmResults = await Promise.all([
            this.imageDM.getPrevImageCount(image, dmSortOrder, dmFilterOptions),
            this.imageDM.getImageCount(dmFilterOptions),
            this.imageDM.getPrevImageId(image, dmSortOrder, dmFilterOptions),
            this.imageDM.getNextImageId(image, dmSortOrder, dmFilterOptions),
        ]);
        const prevImageCount = dmResults[0];
        const totalImageCount = dmResults[1];
        const prevImageId = dmResults[2];
        const nextImageId = dmResults[3];
        return {
            position: prevImageCount + 1,
            totalImageCount,
            prevImageId: prevImageId === null ? undefined : prevImageId,
            nextImageId: nextImageId === null ? undefined : nextImageId,
        };
    }

    private async getDMImageListFilterOptions(
        filterOptions: ImageListFilterOptions | undefined
    ): Promise<DMImageListFilterOptions> {
        const dmFilterOptions = new DMImageListFilterOptions();
        if (filterOptions === undefined) {
            return dmFilterOptions;
        }

        dmFilterOptions.uploadedByUserIdList = filterOptions.uploadedByUserIdList || [];
        dmFilterOptions.notUploadedByUserIdList = filterOptions.notUploadedByUserIdList || [];
        dmFilterOptions.uploadTimeStart = +(filterOptions.uploadTimeStart || 0);
        dmFilterOptions.uploadTimeEnd = +(filterOptions.uploadTimeEnd || 0);

        dmFilterOptions.publishedByUserIdList = filterOptions.publishedByUserIdList || [];
        dmFilterOptions.publishTimeStart = +(filterOptions.publishTimeStart || 0);
        dmFilterOptions.publishTimeEnd = +(filterOptions.publishTimeEnd || 0);

        dmFilterOptions.verifiedByUserIdList = filterOptions.verifiedByUserIdList || [];
        dmFilterOptions.verifyTimeStart = +(filterOptions.verifyTimeStart || 0);
        dmFilterOptions.verifyTimeEnd = +(filterOptions.verifyTimeEnd || 0);

        dmFilterOptions.imageTypeIdList = (filterOptions.imageTypeIdList || []).map((imageTypeId) => {
            return imageTypeId === 0 ? null : imageTypeId;
        });

        dmFilterOptions.originalFileNameQuery = filterOptions.originalFileNameQuery || "";
        dmFilterOptions.imageStatusList = filterOptions.imageStatusList || [];

        let imageIdSet = new Set<number>();
        if (this.shouldUseListFilterOptions(filterOptions.imageTagIdList)) {
            const imageIdList = await this.getImageIdListMatchingImageTagIdList(
                filterOptions.imageTagIdList || [],
                filterOptions.mustMatchAllImageTags || false
            );
            if (dmFilterOptions.shouldFilterByImageIdList) {
                const intersectedImageIdSet = new Set(imageIdList.filter((imageId) => imageIdSet.has(imageId)));
                imageIdSet = intersectedImageIdSet;
            } else {
                dmFilterOptions.shouldFilterByImageIdList = true;
                imageIdSet = new Set(imageIdList);
            }
        }
        if (this.shouldUseListFilterOptions(filterOptions.regionLabelIdList)) {
            const imageIdList = await this.getImageIdListMatchingRegionLabelIdList(
                filterOptions.regionLabelIdList || [],
                filterOptions.mustMatchAllRegionLabels || false
            );
            if (dmFilterOptions.shouldFilterByImageIdList) {
                const intersectedImageIdSet = new Set(imageIdList.filter((imageId) => imageIdSet.has(imageId)));
                imageIdSet = intersectedImageIdSet;
            } else {
                dmFilterOptions.shouldFilterByImageIdList = true;
                imageIdSet = new Set(imageIdList);
            }
        }
        if (this.shouldUseListFilterOptions(filterOptions.bookmarkedByUserIdList)) {
            const imageIdList = await this.getImageIdListBookmarkedByUserIdList(
                filterOptions.bookmarkedByUserIdList || []
            );
            if (dmFilterOptions.shouldFilterByImageIdList) {
                const intersectedImageIdSet = new Set(imageIdList.filter((imageId) => imageIdSet.has(imageId)));
                imageIdSet = intersectedImageIdSet;
            } else {
                dmFilterOptions.shouldFilterByImageIdList = true;
                imageIdSet = new Set(imageIdList);
            }
        }
        dmFilterOptions.imageIdList = Array.from(imageIdSet);

        dmFilterOptions.mustHaveDescription = filterOptions.mustHaveDescription || false;

        return dmFilterOptions;
    }

    private async getImageIdListMatchingImageTagIdList(
        imageTagIdList: number[],
        mustMatchAllImageTag: boolean
    ): Promise<number[]> {
        const imageIdList = await this.imageHasImageTagDM.getImageIdListOfImageTagList(imageTagIdList);
        const imageIdToMatchedImageTagCount = new Map<number, number>();
        for (const imageIdSublist of imageIdList) {
            for (const imageId of imageIdSublist) {
                const currentCount = imageIdToMatchedImageTagCount.get(imageId) || 0;
                imageIdToMatchedImageTagCount.set(imageId, currentCount + 1);
            }
        }
        const matchedImageIdList: number[] = [];
        for (const imageId of imageIdToMatchedImageTagCount.keys()) {
            const matchedImageTagCount = imageIdToMatchedImageTagCount.get(imageId);
            if (mustMatchAllImageTag && matchedImageTagCount !== imageTagIdList.length) {
                continue;
            }
            matchedImageIdList.push(imageId);
        }
        return matchedImageIdList;
    }

    private async getImageIdListMatchingRegionLabelIdList(
        regionLabelIdList: number[],
        mustMatchAllRegionLabel: boolean
    ): Promise<number[]> {
        const imageIdList = await this.regionDM.getOfImageIdListOfRegionLabelList(regionLabelIdList);
        const imageIdToMatchedRegionLabelCount = new Map<number, number>();
        for (const imageIdSublist of imageIdList) {
            const imageIdSubset = new Set<number>(imageIdSublist);
            for (const imageId of imageIdSubset.keys()) {
                const currentCount = imageIdToMatchedRegionLabelCount.get(imageId) || 0;
                imageIdToMatchedRegionLabelCount.set(imageId, currentCount + 1);
            }
        }
        const matchedImageIdList: number[] = [];
        for (const imageId of imageIdToMatchedRegionLabelCount.keys()) {
            const matchedRegionLabelCount = imageIdToMatchedRegionLabelCount.get(imageId);
            if (mustMatchAllRegionLabel && matchedRegionLabelCount !== regionLabelIdList.length) {
                continue;
            }
            matchedImageIdList.push(imageId);
        }
        return matchedImageIdList;
    }

    private async getImageIdListBookmarkedByUserIdList(bookmarkedByUserIdList: number[]): Promise<number[]> {
        const bookmarkList = await this.userBookmarksImageDM.getBookmarkedImageListOfUserIdList(bookmarkedByUserIdList);
        const imageIdList = bookmarkList.map((bookmark) => bookmark.imageId);
        const imageIdSet = new Set<number>(imageIdList);
        return Array.from(imageIdSet);
    }

    private getDMImageListSortOrder(sortOrder: _ImageListSortOrder_Values): DMImageListSortOrder {
        switch (sortOrder) {
            case _ImageListSortOrder_Values.ID_ASCENDING:
                return DMImageListSortOrder.ID_ASCENDING;
            case _ImageListSortOrder_Values.ID_DESCENDING:
                return DMImageListSortOrder.ID_DESCENDING;
            case _ImageListSortOrder_Values.UPLOAD_TIME_ASCENDING:
                return DMImageListSortOrder.UPLOAD_TIME_ASCENDING;
            case _ImageListSortOrder_Values.UPLOAD_TIME_DESCENDING:
                return DMImageListSortOrder.UPLOAD_TIME_DESCENDING;
            case _ImageListSortOrder_Values.PUBLISH_TIME_ASCENDING:
                return DMImageListSortOrder.PUBLISH_TIME_ASCENDING;
            case _ImageListSortOrder_Values.PUBLISH_TIME_DESCENDING:
                return DMImageListSortOrder.PUBLISH_TIME_DESCENDING;
            case _ImageListSortOrder_Values.VERIFY_TIME_ASCENDING:
                return DMImageListSortOrder.VERIFY_TIME_ASCENDING;
            case _ImageListSortOrder_Values.VERIFY_TIME_DESCENDING:
                return DMImageListSortOrder.VERIFY_TIME_DESCENDING;
            default:
                this.logger.error("invalid sort_order value", { sortOrder });
                throw new ErrorWithStatus(`invalid sort_order value ${sortOrder}`, status.INVALID_ARGUMENT);
        }
    }

    private shouldUseListFilterOptions(filterOptionsList: any[] | undefined): boolean {
        return filterOptionsList !== undefined && filterOptionsList.length > 0;
    }

    public async updateImageListImageType(idList: number[], imageTypeId: number): Promise<void> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("image type with image_type_id not found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(`image type with image_type_id ${imageTypeId} not found`, status.NOT_FOUND);
        }

        return this.imageDM.withTransaction(async (imageDM) => {
            return this.regionDM.withTransaction(async (regionDM) => {
                return this.imageHasImageTagDM.withTransaction(async (imageHasImageTagDM) => {
                    for (const imageId of idList) {
                        const image = await imageDM.getImageWithXLock(imageId);
                        if (image === null) {
                            this.logger.error("image with image_id not found", { imageId });
                            throw new ErrorWithStatus(`image with image_id ${imageId} not found`, status.NOT_FOUND);
                        }
                        await regionDM.updateLabelOfRegionOfImage(imageId, null);
                        await imageHasImageTagDM.deleteImageHasImageTagOfImage(imageId);
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
                });
            });
        });
    }

    public async deleteImageList(idList: number[]): Promise<void> {
        return this.imageDM.deleteImageList(idList);
    }

    public async addImageTagListToImageList(imageIdList: number[], imageTagIdList: number[]): Promise<void> {
        await this.addImageTagToImageOperator.run(imageIdList, imageTagIdList);
    }
}

injected(
    ImageListManagementOperatorImpl,
    ADD_IMAGE_TAG_TO_IMAGE_OPERATOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    REGION_DATA_ACCESSOR_TOKEN,
    USER_BOOKMARKS_IMAGE_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_LIST_MANAGEMENT_OPERATOR_TOKEN = token<ImageListManagementOperator>("ImageListManagementOperator");
