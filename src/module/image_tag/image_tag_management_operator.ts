import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import validator from "validator";
import { Logger } from "winston";
import {
    ImageTagDataAccessor,
    ImageTagGroupDataAccessor,
    ImageTagGroupHasImageTypeDataAccessor,
    ImageTypeDataAccessor,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { ImageTag } from "../../proto/gen/ImageTag";
import { ImageTagGroup } from "../../proto/gen/ImageTagGroup";
import { ImageType } from "../../proto/gen/ImageType";
import { RegionLabel } from "../../proto/gen/RegionLabel";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";

export interface ImageTagManagementOperator {
    createImageTagGroup(
        displayName: string,
        isSingleValue: boolean
    ): Promise<ImageTagGroup>;
    getImageTagGroupList(
        withImageTag: boolean,
        withImageType: boolean
    ): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][] | null;
        imageTypeList: ImageType[][] | null;
    }>;
    updateImageTagGroup(
        id: number,
        displayName: string | undefined,
        isSingleValue: boolean | undefined
    ): Promise<ImageTagGroup>;
    deleteImageTagGroup(id: number): Promise<void>;
    createImageTag(
        ofImageTypeId: number,
        displayName: string
    ): Promise<ImageTag>;
    updateImageTag(
        ofImageTypeId: number,
        id: number,
        displayName: string | undefined
    ): Promise<ImageTag>;
    deleteImageTag(ofImageTagGroupId: number, id: number): Promise<void>;
    addImageTypeToImageTagGroup(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void>;
    removeImageTypeFromImageTagGroup(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void>;
    getImageTagGroupListOfImageType(imageTypeId: number): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][];
    }>;
}

export class ImageTagManagementOperatorImpl
    implements ImageTagManagementOperator
{
    constructor(
        private readonly imageTagGroupDM: ImageTagGroupDataAccessor,
        private readonly imageTagDM: ImageTagDataAccessor,
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly imageTagGroupHasImageTypeDM: ImageTagGroupHasImageTypeDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createImageTagGroup(
        displayName: string,
        isSingleValue: boolean
    ): Promise<ImageTagGroup> {
        displayName = this.sanitizeImageTagGroupDisplayName(displayName);
        if (!this.isValidImageTagGroupDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(
                `invalid display name ${displayName}`,
                status.INVALID_ARGUMENT
            );
        }

        const createdImageTagGroupId =
            await this.imageTagGroupDM.createImageTagGroup(
                displayName,
                isSingleValue
            );
        return {
            id: createdImageTagGroupId,
            displayName: displayName,
            isSingleValue: isSingleValue,
        };
    }

    public async getImageTagGroupList(
        withImageTag: boolean,
        withImageType: boolean
    ): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][] | null;
        imageTypeList: ImageType[][] | null;
    }> {
        const imageTagGroupList =
            await this.imageTagGroupDM.getImageTagGroupList();
        const imageTagGroupIdList = imageTagGroupList.map(
            (imageTagGroup) => imageTagGroup.id
        );

        let imageTagList: ImageTag[][] | null = null;
        if (withImageTag) {
            imageTagList =
                await this.imageTagDM.getImageTagListOfImageTagGroupIdList(
                    imageTagGroupIdList
                );
        }

        let imageTypeList: ImageType[][] | null = null;
        if (withImageType) {
            imageTypeList =
                await this.imageTagGroupHasImageTypeDM.getImageTypeListOfImageTagGroupList(
                    imageTagGroupIdList
                );
        }

        return { imageTagGroupList, imageTagList, imageTypeList };
    }

    public async updateImageTagGroup(
        id: number,
        displayName: string | undefined,
        isSingleValue: boolean | undefined
    ): Promise<ImageType> {
        if (displayName !== undefined) {
            displayName = this.sanitizeImageTagGroupDisplayName(displayName);
            if (!this.isValidImageTagGroupDisplayName(displayName)) {
                this.logger.error("invalid display name", { displayName });
                throw new ErrorWithStatus(
                    `invalid display name ${displayName}`,
                    status.INVALID_ARGUMENT
                );
            }
        }

        return this.imageTagGroupDM.withTransaction(async (dm) => {
            const imageTagGroup = await dm.getImageTagGroupWithXLock(id);
            if (imageTagGroup === null) {
                this.logger.error(
                    "no image tag group with image_tag_group_id found",
                    { imageTagGroupId: id }
                );
                throw new ErrorWithStatus(
                    `no image tag group with image_tag_group_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (displayName !== undefined) {
                imageTagGroup.displayName = displayName;
            }
            if (isSingleValue !== undefined) {
                imageTagGroup.isSingleValue = isSingleValue;
            }

            await dm.updateImageTagGroup(imageTagGroup);
            return imageTagGroup;
        });
    }

    public async deleteImageTagGroup(id: number): Promise<void> {
        return this.imageTagGroupDM.deleteImageTagGroup(id);
    }

    public async createImageTag(
        ofImageTagGroupId: number,
        displayName: string
    ): Promise<RegionLabel> {
        displayName = this.sanitizeImageTagDisplayName(displayName);
        if (!this.isValidImageTagDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(
                `invalid display name ${displayName}`,
                status.INVALID_ARGUMENT
            );
        }

        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            ofImageTagGroupId
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupId: ofImageTagGroupId }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${ofImageTagGroupId} found`,
                status.NOT_FOUND
            );
        }

        const createdImageTagId = await this.imageTagDM.createImageTag(
            ofImageTagGroupId,
            displayName
        );
        return {
            id: createdImageTagId,
            displayName: displayName,
        };
    }

    public async updateImageTag(
        ofImageTagGroupId: number,
        id: number,
        displayName: string | undefined
    ): Promise<RegionLabel> {
        if (displayName !== undefined) {
            displayName = this.sanitizeImageTagDisplayName(displayName);
            if (!this.isValidImageTagDisplayName(displayName)) {
                this.logger.error("invalid display name", { displayName });
                throw new ErrorWithStatus(
                    `invalid display name ${displayName}`,
                    status.INVALID_ARGUMENT
                );
            }
        }

        return this.imageTagDM.withTransaction(async (dm) => {
            const imageTag = await dm.getImageTagWithXLock(id);
            if (imageTag === null) {
                this.logger.error("no image tag with image_tag_id found", {
                    imageTagId: id,
                });
                throw new ErrorWithStatus(
                    `no region label with region_label_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (imageTag.ofImageTagGroupId !== ofImageTagGroupId) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image tag with image_tag_id",
                    { imageTypeId: ofImageTagGroupId, imageTagId: id }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${ofImageTagGroupId} does not have image tag with image_tag_id ${id}`,
                    status.NOT_FOUND
                );
            }

            if (displayName !== undefined) {
                imageTag.displayName = displayName;
            }

            await dm.updateImageTag(imageTag);
            return imageTag;
        });
    }

    public async deleteImageTag(
        ofImageTagGroupId: number,
        id: number
    ): Promise<void> {
        return this.imageTagDM.withTransaction(async (dm) => {
            const imageTag = await dm.getImageTagWithXLock(id);
            if (imageTag === null) {
                this.logger.error("no image tag with image_tag_id found", {
                    imageTagId: id,
                });
                throw new ErrorWithStatus(
                    `no image tag with image_tag_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (imageTag.ofImageTagGroupId !== ofImageTagGroupId) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image tag with image_tag_id",
                    { imageTypeId: ofImageTagGroupId, imageTagId: id }
                );
                throw new ErrorWithStatus(
                    `image type with image_type_id ${ofImageTagGroupId} does not have region label ${id}`,
                    status.NOT_FOUND
                );
            }

            await dm.deleteImageTag(id);
        });
    }

    public async addImageTypeToImageTagGroup(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            imageTagGroupId
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupId }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupId} found`,
                status.NOT_FOUND
            );
        }
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeId} found`,
                status.NOT_FOUND
            );
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(
                imageTagGroupId,
                imageTypeId
            );
            if (relation !== null) {
                this.logger.error(
                    "image tag group with image_tag_group_id already has image type with image_type_id",
                    { imageTagGroupId, imageTypeId }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupId} already has image type with image_type_id ${imageTypeId}`,
                    status.ALREADY_EXISTS
                );
            }
            await dm.createImageTagGroupHasImageType(
                imageTagGroupId,
                imageTypeId
            );
        });
    }

    public async removeImageTypeFromImageTagGroup(
        imageTagGroupId: number,
        imageTypeId: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            imageTagGroupId
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupId }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupId} found`,
                status.NOT_FOUND
            );
        }
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeId} found`,
                status.NOT_FOUND
            );
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(
                imageTagGroupId,
                imageTypeId
            );
            if (relation === null) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image type with image_type_id",
                    { imageTagGroupId, imageTypeId }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupId} does not have image type with image_type_id ${imageTypeId}`,
                    status.FAILED_PRECONDITION
                );
            }
            await dm.deleteImageTagGroupHasImageType(
                imageTagGroupId,
                imageTypeId
            );
        });
    }

    public async getImageTagGroupListOfImageType(imageTypeId: number): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][];
    }> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeId);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeId,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeId} found`,
                status.NOT_FOUND
            );
        }
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

        return { imageTagGroupList, imageTagList };
    }

    private sanitizeImageTagGroupDisplayName(displayName: string): string {
        return validator.escape(validator.trim(displayName));
    }

    private isValidImageTagGroupDisplayName(displayName: string): boolean {
        return validator.isLength(displayName, { min: 1, max: 256 });
    }

    private sanitizeImageTagDisplayName(displayName: string): string {
        return validator.escape(validator.trim(displayName));
    }

    private isValidImageTagDisplayName(displayName: string): boolean {
        return validator.isLength(displayName, { min: 1, max: 256 });
    }
}

injected(
    ImageTagManagementOperatorImpl,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN =
    token<ImageTagManagementOperator>("ImageTagManagementOperator");
