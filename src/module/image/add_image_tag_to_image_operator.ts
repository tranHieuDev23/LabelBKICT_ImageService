import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    ImageTagGroupDataAccessor,
    ImageTagGroupHasImageTypeDataAccessor,
    ImageTagDataAccessor,
    ImageHasImageTagDataAccessor,
    Image,
    ImageTag,
    ImageTagGroup,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { ErrorWithStatus, getUniqueValueList, LOGGER_TOKEN } from "../../utils";

export interface AddImageTagToImageOperator {
    run(imageIdList: number[], imageTagIdList: number[]): Promise<void>;
}

export class AddImageTagToImageOperatorImpl implements AddImageTagToImageOperator {
    constructor(
        private readonly imageDM: ImageDataAccessor,
        private readonly imageTagGroupDM: ImageTagGroupDataAccessor,
        private readonly imageTagGroupHasImageTypeDM: ImageTagGroupHasImageTypeDataAccessor,
        private readonly imageTagDM: ImageTagDataAccessor,
        private readonly imageHasImageTagDM: ImageHasImageTagDataAccessor,
        private readonly logger: Logger
    ) {}

    public async run(imageIdList: number[], imageTagIdList: number[]): Promise<void> {
        imageIdList = getUniqueValueList(imageIdList);
        imageTagIdList = getUniqueValueList(imageTagIdList);

        const imageList = await this.getImageList(imageIdList);
        const imageTagOfImageList = await this.imageHasImageTagDM.getImageTagListOfImageList(imageIdList);
        const imageTagList = await this.getImageTagList(imageTagIdList);
        const imageTagGroupIdList = getUniqueValueList(imageTagList.map((imageTag) => imageTag.ofImageTagGroupId));
        const idToImageTagGroupMap = await this.getIdToImageTagGroupMap(imageTagGroupIdList);
        const idToImageTypeIdSetOfImageTagGroupMap = await this.getIdToImageTypeIdSetOfImageTagGroupMap(
            imageTagGroupIdList
        );

        if (
            !this.canAddImageTagListToImageList(
                imageList,
                imageTagOfImageList,
                imageTagList,
                idToImageTagGroupMap,
                idToImageTypeIdSetOfImageTagGroupMap
            )
        ) {
            this.logger.error("cannot add image tag list to image list", { imageIdList, imageTagIdList });
            throw new ErrorWithStatus("cannot add image tag list to image list", status.FAILED_PRECONDITION);
        }

        for (const imageId of imageIdList) {
            for (const imageTagId of imageTagIdList) {
                await this.imageHasImageTagDM.createImageHasImageTag(imageId, imageTagId);
            }
        }
    }

    public async getImageList(imageIdList: number[]): Promise<Image[]> {
        const imageList = await this.imageDM.getImageListWithIdList(imageIdList);
        const nonNullImageList = [];
        for (const image of imageList) {
            if (image === null) {
                this.logger.error("one or more image not found", { imageIdList });
                throw new ErrorWithStatus("one or more image not found", status.NOT_FOUND);
            }
            nonNullImageList.push(image);
        }
        return nonNullImageList;
    }

    public async getImageTagList(imageTagIdList: number[]): Promise<ImageTag[]> {
        const imageTagList = await this.imageTagDM.getImageTagWithIdList(imageTagIdList);
        const nonNullImageTagList = [];
        for (const imageTag of imageTagList) {
            if (imageTag === null) {
                this.logger.error("one or more image tag not found", { imageTagIdList });
                throw new ErrorWithStatus("one or more image tag not found", status.NOT_FOUND);
            }
            nonNullImageTagList.push(imageTag);
        }
        return nonNullImageTagList;
    }

    private async getIdToImageTagGroupMap(imageTagGroupIdList: number[]): Promise<Map<number, ImageTagGroup>> {
        const imageTagGroupList = await this.imageTagGroupDM.getImageTagGroupListWithIdList(imageTagGroupIdList);
        const idToImageTagGroupMap = new Map<number, ImageTagGroup>();
        for (const imageTagGroup of imageTagGroupList) {
            if (imageTagGroup === null) {
                continue;
            }
            idToImageTagGroupMap.set(imageTagGroup.id, imageTagGroup);
        }
        return idToImageTagGroupMap;
    }

    private async getIdToImageTypeIdSetOfImageTagGroupMap(
        imageTagGroupIdList: number[]
    ): Promise<Map<number, Set<number>>> {
        const imageTypeListOfImageTagGroupList =
            await this.imageTagGroupHasImageTypeDM.getImageTypeIdListOfImageTagGroupList(imageTagGroupIdList);
        const idToImageTypeListOfImageTagGroupMap = new Map<number, Set<number>>();
        for (let i = 0; i < imageTagGroupIdList.length; i++) {
            const imageTagGroupId = imageTagGroupIdList[i];
            const imageTypeList = imageTypeListOfImageTagGroupList[i];
            idToImageTypeListOfImageTagGroupMap.set(imageTagGroupId, new Set(imageTypeList));
        }
        return idToImageTypeListOfImageTagGroupMap;
    }

    private canAddImageTagListToImageList(
        imageList: Image[],
        imageTagListOfImageList: ImageTag[][],
        imageTagList: ImageTag[],
        idToImageTagGroupMap: Map<number, ImageTagGroup>,
        idToImageTypeListOfImageTagGroupMap: Map<number, Set<number>>
    ): boolean {
        for (let i = 0; i < imageList.length; i++) {
            const image = imageList[i];
            const imageTagListOfImage = imageTagListOfImageList[i];
            if (
                !this.canAddImageTagListToImage(
                    image,
                    imageTagListOfImage,
                    imageTagList,
                    idToImageTagGroupMap,
                    idToImageTypeListOfImageTagGroupMap
                )
            ) {
                return false;
            }
        }
        return true;
    }

    private canAddImageTagListToImage(
        image: Image,
        imageTagListOfImage: ImageTag[],
        imageTagList: ImageTag[],
        idToImageTagGroupMap: Map<number, ImageTagGroup>,
        idToImageTypeListOfImageTagGroupMap: Map<number, Set<number>>
    ): boolean {
        if (image.imageType === null) {
            this.logger.error("image does not have image type, cannot assign tag", { imageId: image.id });
            throw new ErrorWithStatus(`image does not have image type, cannot assign tag`, status.FAILED_PRECONDITION);
        }

        for (const imageTag of imageTagList) {
            const imageTagGroup = idToImageTagGroupMap.get(imageTag.ofImageTagGroupId);
            if (imageTagGroup === undefined) {
                this.logger.error("image tag group not found", { imageTagGroupId: imageTag.ofImageTagGroupId });
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTag.ofImageTagGroupId} not found`,
                    status.NOT_FOUND
                );
            }

            const imageTypeIdSetOfImageTagGroup = idToImageTypeListOfImageTagGroupMap.get(imageTag.ofImageTagGroupId);
            if (imageTypeIdSetOfImageTagGroup === undefined) {
                this.logger.error("image type list of image tag group not found", {
                    imageTagGroupId: imageTag.ofImageTagGroupId,
                });
                throw new ErrorWithStatus(
                    `image type list of image tag group with image_tag_group_id ${imageTag.ofImageTagGroupId} not found`,
                    status.NOT_FOUND
                );
            }

            if (
                !this.canAddImageTagToImage(
                    image,
                    imageTagListOfImage,
                    imageTag,
                    imageTagGroup,
                    imageTypeIdSetOfImageTagGroup
                )
            ) {
                return false;
            }
        }

        return true;
    }

    private canAddImageTagToImage(
        image: Image,
        imageTagListOfImage: ImageTag[],
        imageTag: ImageTag,
        imageTagGroup: ImageTagGroup,
        imageTypeListOfImageTagGroup: Set<number>
    ): boolean {
        const imageTypeId = image.imageType?.id || 0;
        if (!imageTypeListOfImageTagGroup.has(imageTypeId)) {
            this.logger.info("image tag group does not have image type", {
                imageTagGroupId: imageTagGroup.id,
                imageTypeId,
            });
            return false;
        }

        const imageAlreadyHasTag = imageTagListOfImage.find((item) => item.id === imageTag.id) !== undefined;
        if (imageAlreadyHasTag) {
            this.logger.info("image already has image tag", {
                imageId: image.id,
                imageTagId: imageTag.id,
            });
            return false;
        }

        if (imageTagGroup?.isSingleValue) {
            for (const item of imageTagListOfImage) {
                if (item.ofImageTagGroupId === imageTagGroup.id) {
                    this.logger.info("image with image_id already has tag of image tag group with image_tag_group_id", {
                        imageId: image.id,
                        imageTagGroupId: imageTagGroup.id,
                    });
                    return false;
                }
            }
        }

        return true;
    }
}

injected(
    AddImageTagToImageOperatorImpl,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const ADD_IMAGE_TAG_TO_IMAGE_OPERATOR_TOKEN = token<AddImageTagToImageOperator>("AddImageTagToImageOperator");
