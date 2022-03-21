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
        ofImageTypeID: number,
        displayName: string
    ): Promise<ImageTag>;
    updateImageTag(
        ofImageTypeID: number,
        id: number,
        displayName: string | undefined
    ): Promise<ImageTag>;
    deleteImageTag(ofImageTagGroupID: number, id: number): Promise<void>;
    addImageTypeToImageTagGroup(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void>;
    removeImageTypeFromImageTagGroup(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void>;
    getImageTagGroupListOfImageType(imageTypeID: number): Promise<{
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

        const createdImageTagGroupID =
            await this.imageTagGroupDM.createImageTagGroup(
                displayName,
                isSingleValue
            );
        return {
            id: createdImageTagGroupID,
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
        const imageTagGroupIDList = imageTagGroupList.map(
            (imageTagGroup) => imageTagGroup.id
        );

        let imageTagList: ImageTag[][] | null = null;
        if (withImageTag) {
            imageTagList =
                await this.imageTagDM.getImageTagListOfImageTagGroupIDList(
                    imageTagGroupIDList
                );
        }

        let imageTypeList: ImageType[][] | null = null;
        if (withImageType) {
            imageTypeList =
                await this.imageTagGroupHasImageTypeDM.getImageTypeListOfImageTagGroupList(
                    imageTagGroupIDList
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
                    { imageTagGroupID: id }
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
        ofImageTagGroupID: number,
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
            ofImageTagGroupID
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupID: ofImageTagGroupID }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${ofImageTagGroupID} found`,
                status.NOT_FOUND
            );
        }

        const createdImageTagID = await this.imageTagDM.createImageTag(
            ofImageTagGroupID,
            displayName
        );
        return {
            id: createdImageTagID,
            displayName: displayName,
        };
    }

    public async updateImageTag(
        ofImageTagGroupID: number,
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
                    imageTagID: id,
                });
                throw new ErrorWithStatus(
                    `no region label with region_label_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (imageTag.ofImageTagGroupID !== ofImageTagGroupID) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image tag with image_tag_id",
                    { imageTypeID: ofImageTagGroupID, imageTagID: id }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${ofImageTagGroupID} does not have image tag with image_tag_id ${id}`,
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
        ofImageTagGroupID: number,
        id: number
    ): Promise<void> {
        return this.imageTagDM.withTransaction(async (dm) => {
            const imageTag = await dm.getImageTagWithXLock(id);
            if (imageTag === null) {
                this.logger.error("no image tag with image_tag_id found", {
                    imageTagID: id,
                });
                throw new ErrorWithStatus(
                    `no image tag with image_tag_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (imageTag.ofImageTagGroupID !== ofImageTagGroupID) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image tag with image_tag_id",
                    { imageTypeID: ofImageTagGroupID, imageTagID: id }
                );
                throw new ErrorWithStatus(
                    `image type with image_type_id ${ofImageTagGroupID} does not have region label ${id}`,
                    status.NOT_FOUND
                );
            }

            await dm.deleteImageTag(id);
        });
    }

    public async addImageTypeToImageTagGroup(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            imageTagGroupID
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupID }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupID} found`,
                status.NOT_FOUND
            );
        }
        const imageType = await this.imageTypeDM.getImageType(imageTypeID);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeID,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeID} found`,
                status.NOT_FOUND
            );
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(
                imageTagGroupID,
                imageTypeID
            );
            if (relation !== null) {
                this.logger.error(
                    "image tag group with image_tag_group_id already has image type with image_type_id",
                    { imageTagGroupID, imageTypeID }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupID} already has image type with image_type_id ${imageTypeID}`,
                    status.ALREADY_EXISTS
                );
            }
            await dm.createImageTagGroupHasImageType(
                imageTagGroupID,
                imageTypeID
            );
        });
    }

    public async removeImageTypeFromImageTagGroup(
        imageTagGroupID: number,
        imageTypeID: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(
            imageTagGroupID
        );
        if (imageTagGroup === null) {
            this.logger.error(
                "no image tag group with image_tag_group_id found",
                { imageTagGroupID }
            );
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupID} found`,
                status.NOT_FOUND
            );
        }
        const imageType = await this.imageTypeDM.getImageType(imageTypeID);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeID,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeID} found`,
                status.NOT_FOUND
            );
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(
                imageTagGroupID,
                imageTypeID
            );
            if (relation === null) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image type with image_type_id",
                    { imageTagGroupID, imageTypeID }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupID} does not have image type with image_type_id ${imageTypeID}`,
                    status.FAILED_PRECONDITION
                );
            }
            await dm.deleteImageTagGroupHasImageType(
                imageTagGroupID,
                imageTypeID
            );
        });
    }

    public async getImageTagGroupListOfImageType(imageTypeID: number): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][];
    }> {
        const imageType = await this.imageTypeDM.getImageType(imageTypeID);
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeID,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${imageTypeID} found`,
                status.NOT_FOUND
            );
        }
        const imageTagGroupList =
            await this.imageTagGroupHasImageTypeDM.getImageTagGroupOfImageType(
                imageTypeID
            );

        const imageTagGroupIDList = imageTagGroupList.map(
            (imageTagGroup) => imageTagGroup.id
        );
        const imageTagList =
            await this.imageTagDM.getImageTagListOfImageTagGroupIDList(
                imageTagGroupIDList
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
