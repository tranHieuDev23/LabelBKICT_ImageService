import { Image } from "../../proto/gen/Image";
import { ImageListFilterOptions } from "../../proto/gen/ImageListFilterOptions";
import { _ImageListSortOrder_Values } from "../../proto/gen/ImageListSortOrder";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";
import { ImageTag } from "../../proto/gen/ImageTag";
import { Region } from "../../proto/gen/Region";

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
