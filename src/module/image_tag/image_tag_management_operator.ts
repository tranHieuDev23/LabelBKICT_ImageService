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
    ImageTagGroupHasClassificationTypeDataAccessor,
    IMAGE_TAG_GROUP_HAS_CLASSIFICATION_TYPE_DATA_ACCESSOR_TOKEN
} from "../../dataaccess/db";
import { ImageTag } from "../../proto/gen/ImageTag";
import { ImageTagGroup } from "../../proto/gen/ImageTagGroup";
import { ImageType } from "../../proto/gen/ImageType";
import { RegionLabel } from "../../proto/gen/RegionLabel";
import { ErrorWithStatus, LOGGER_TOKEN, promisifyGRPCCall } from "../../utils";
import { ModelServiceClient } from "../../proto/gen/ModelService";
import { MODEL_SERVICE_DM_TOKEN } from "../../dataaccess/grpc";
import { ClassificationType } from "../../proto/gen/ClassificationType";

export interface ImageTagManagementOperator {
    createImageTagGroup(displayName: string, isSingleValue: boolean): Promise<ImageTagGroup>;
    getImageTagGroupList(
        withImageTag: boolean,
        withImageType: boolean,
        withClassificationType: boolean
    ): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][] | null;
        imageTypeList: ImageType[][] | null;
        classificationTypeList: ClassificationType[][] | null;
    }>;
    updateImageTagGroup(
        id: number,
        displayName: string | undefined,
        isSingleValue: boolean | undefined
    ): Promise<ImageTagGroup>;
    deleteImageTagGroup(id: number): Promise<void>;
    createImageTag(ofImageTypeId: number, displayName: string): Promise<ImageTag>;
    updateImageTag(ofImageTypeId: number, id: number, displayName: string | undefined): Promise<ImageTag>;
    deleteImageTag(ofImageTagGroupId: number, id: number): Promise<void>;
    addImageTypeToImageTagGroup(imageTagGroupId: number, imageTypeId: number): Promise<void>;
    removeImageTypeFromImageTagGroup(imageTagGroupId: number, imageTypeId: number): Promise<void>;
    getImageTagGroupListOfImageType(imageTypeId: number): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][];
    }>;
    getImageTagGroupListOfImageTypeList(imageTypeIdList: number[]): Promise<
        {
            imageTagGroupList: ImageTagGroup[];
            imageTagList: ImageTag[][];
        }[]
    >;
    addClassificationTypeToImageTagGroup(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void>;
    removeImageTagGroupHasClassificationType(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void>;
}

export class ImageTagManagementOperatorImpl implements ImageTagManagementOperator {
    constructor(
        private readonly imageTagGroupDM: ImageTagGroupDataAccessor,
        private readonly imageTagDM: ImageTagDataAccessor,
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly imageTagGroupHasImageTypeDM: ImageTagGroupHasImageTypeDataAccessor,
        private readonly imageTagGroupHasClassificationTypeDM: ImageTagGroupHasClassificationTypeDataAccessor,
        private readonly modelServiceDM: ModelServiceClient,
        private readonly logger: Logger
    ) {}

    public async createImageTagGroup(displayName: string, isSingleValue: boolean): Promise<ImageTagGroup> {
        displayName = this.sanitizeImageTagGroupDisplayName(displayName);
        if (!this.isValidImageTagGroupDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(`invalid display name ${displayName}`, status.INVALID_ARGUMENT);
        }

        const createdImageTagGroupId = await this.imageTagGroupDM.createImageTagGroup(displayName, isSingleValue);
        return {
            id: createdImageTagGroupId,
            displayName: displayName,
            isSingleValue: isSingleValue,
        };
    }

    public async getImageTagGroupList(
        withImageTag: boolean,
        withImageType: boolean,
        withClassificationType: boolean
    ): Promise<{
        imageTagGroupList: ImageTagGroup[];
        imageTagList: ImageTag[][] | null;
        imageTypeList: ImageType[][] | null;
        classificationTypeList: ClassificationType[][] | null;
    }> {
        const imageTagGroupList = await this.imageTagGroupDM.getImageTagGroupList();
        const imageTagGroupIdList = imageTagGroupList.map((imageTagGroup) => imageTagGroup.id);

        let imageTagList: ImageTag[][] | null = null;
        if (withImageTag) {
            imageTagList = await this.imageTagDM.getImageTagListOfImageTagGroupIdList(imageTagGroupIdList);
        }

        let imageTypeList: ImageType[][] | null = null;
        if (withImageType) {
            imageTypeList = await this.imageTagGroupHasImageTypeDM.getImageTypeListOfImageTagGroupList(
                imageTagGroupIdList
            );
        }

        let classificationTypeList: ClassificationType[][] | null = [];
        if (withClassificationType) {
            let classificationTypeIdOfImageTagGroupId: number[][] | null = 
                await this.imageTagGroupHasClassificationTypeDM.getImageTagGroupHasClassificationTypeList(imageTagGroupIdList);

            if (classificationTypeIdOfImageTagGroupId.flat().length != 0) {
                let distinctClassificationTypeId: number[] = classificationTypeIdOfImageTagGroupId.flat();
                const classificationTypeListOfIdList = await this.getClassificationTypeList(distinctClassificationTypeId);

                for (let index in classificationTypeIdOfImageTagGroupId) {
                    const classificationTypeIdList = classificationTypeIdOfImageTagGroupId[index];
                    const classificationTypeListOfImageTagGroup: ClassificationType[] = [];
                    for (let classificationTypeId of classificationTypeIdList) {
                        const classificationType: ClassificationType = classificationTypeListOfIdList.filter(
                            (classificationType) => classificationType.classificationTypeId === classificationTypeId
                        )[0];
                        classificationTypeListOfImageTagGroup.push(
                            this.imageTagGroupHasClassificationTypeDM.convertToClassificationTypeObject(
                                classificationType.classificationTypeId || 0,
                                classificationType.displayName || ""
                            )
                        );
                    }
                    classificationTypeList[index] = classificationTypeListOfImageTagGroup;
                    
                }
            } else {
                for (let index in classificationTypeIdOfImageTagGroupId) {
                    classificationTypeList[index] = [];
                }
            }
        }
        return { imageTagGroupList, imageTagList, imageTypeList, classificationTypeList };
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
                throw new ErrorWithStatus(`invalid display name ${displayName}`, status.INVALID_ARGUMENT);
            }
        }

        return this.imageTagGroupDM.withTransaction(async (dm) => {
            const imageTagGroup = await dm.getImageTagGroupWithXLock(id);
            if (imageTagGroup === null) {
                this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId: id });
                throw new ErrorWithStatus(`no image tag group with image_tag_group_id ${id} found`, status.NOT_FOUND);
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

    public async createImageTag(ofImageTagGroupId: number, displayName: string): Promise<RegionLabel> {
        displayName = this.sanitizeImageTagDisplayName(displayName);
        if (!this.isValidImageTagDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(`invalid display name ${displayName}`, status.INVALID_ARGUMENT);
        }

        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(ofImageTagGroupId);
        if (imageTagGroup === null) {
            this.logger.error("no image tag group with image_tag_group_id found", {
                imageTagGroupId: ofImageTagGroupId,
            });
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${ofImageTagGroupId} found`,
                status.NOT_FOUND
            );
        }

        const createdImageTagId = await this.imageTagDM.createImageTag(ofImageTagGroupId, displayName);
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
                throw new ErrorWithStatus(`invalid display name ${displayName}`, status.INVALID_ARGUMENT);
            }
        }

        return this.imageTagDM.withTransaction(async (dm) => {
            const imageTag = await dm.getImageTagWithXLock(id);
            if (imageTag === null) {
                this.logger.error("no image tag with image_tag_id found", {
                    imageTagId: id,
                });
                throw new ErrorWithStatus(`no region label with region_label_id ${id} found`, status.NOT_FOUND);
            }

            if (imageTag.ofImageTagGroupId !== ofImageTagGroupId) {
                this.logger.error("image tag group with image_tag_group_id does not have image tag with image_tag_id", {
                    imageTypeId: ofImageTagGroupId,
                    imageTagId: id,
                });
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

    public async deleteImageTag(ofImageTagGroupId: number, id: number): Promise<void> {
        return this.imageTagDM.withTransaction(async (dm) => {
            const imageTag = await dm.getImageTagWithXLock(id);
            if (imageTag === null) {
                this.logger.error("no image tag with image_tag_id found", {
                    imageTagId: id,
                });
                throw new ErrorWithStatus(`no image tag with image_tag_id ${id} found`, status.NOT_FOUND);
            }

            if (imageTag.ofImageTagGroupId !== ofImageTagGroupId) {
                this.logger.error("image tag group with image_tag_group_id does not have image tag with image_tag_id", {
                    imageTypeId: ofImageTagGroupId,
                    imageTagId: id,
                });
                throw new ErrorWithStatus(
                    `image type with image_type_id ${ofImageTagGroupId} does not have region label ${id}`,
                    status.NOT_FOUND
                );
            }

            await dm.deleteImageTag(id);
        });
    }

    public async addImageTypeToImageTagGroup(imageTagGroupId: number, imageTypeId: number): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(imageTagGroupId);
        if (imageTagGroup === null) {
            this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId });
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
            throw new ErrorWithStatus(`no image type with image_type_id ${imageTypeId} found`, status.NOT_FOUND);
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(imageTagGroupId, imageTypeId);
            if (relation !== null) {
                this.logger.error("image tag group with image_tag_group_id already has image type with image_type_id", {
                    imageTagGroupId,
                    imageTypeId,
                });
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupId} already has image type with image_type_id ${imageTypeId}`,
                    status.ALREADY_EXISTS
                );
            }
            await dm.createImageTagGroupHasImageType(imageTagGroupId, imageTypeId);
        });
    }

    public async removeImageTypeFromImageTagGroup(imageTagGroupId: number, imageTypeId: number): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(imageTagGroupId);
        if (imageTagGroup === null) {
            this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId });
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
            throw new ErrorWithStatus(`no image type with image_type_id ${imageTypeId} found`, status.NOT_FOUND);
        }
        return this.imageTagGroupHasImageTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasImageTypeWithXLock(imageTagGroupId, imageTypeId);
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
            await dm.deleteImageTagGroupHasImageType(imageTagGroupId, imageTypeId);
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
            throw new ErrorWithStatus(`no image type with image_type_id ${imageTypeId} found`, status.NOT_FOUND);
        }
        const imageTagGroupList = await this.imageTagGroupHasImageTypeDM.getImageTagGroupOfImageType(imageTypeId);

        const imageTagGroupIdList = imageTagGroupList.map((imageTagGroup) => imageTagGroup.id);
        const imageTagList = await this.imageTagDM.getImageTagListOfImageTagGroupIdList(imageTagGroupIdList);

        return { imageTagGroupList, imageTagList };
    }

    public async getImageTagGroupListOfImageTypeList(imageTypeIdList: number[]): Promise<
        {
            imageTagGroupList: ImageTagGroup[];
            imageTagList: ImageTag[][];
        }[]
    > {
        return Promise.all(imageTypeIdList.map((imageTypeId) => this.getImageTagGroupListOfImageType(imageTypeId)));
    }

    public async addClassificationTypeToImageTagGroup(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(imageTagGroupId);
        if (imageTagGroup === null) {
            this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId });
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupId} found`,
                status.NOT_FOUND
            );
        }

        //check classification type is exist
        const { error: getClassificationTypeError, response: getClassificationTypeResponse } =
            await promisifyGRPCCall(
                this.modelServiceDM.getClassificationType.bind(this.modelServiceDM),
                { classificationTypeId: classificationTypeId }
            );
        
        if (getClassificationTypeError !== null) {
            this.logger.error(
                "no classification type with classification_type_id found",
                { classificationTypeId },
            );
            throw new ErrorWithStatus(
                `no classification type with classification_type_id ${classificationTypeId} found`,
                status.NOT_FOUND
            );
        }
        if (getClassificationTypeResponse?.classificationType === undefined) {
            this.logger.error(
                "invalid response from model_service.getClassificationType()"
            );
            throw new ErrorWithStatus(
                "failed to get classification type by display name",
                status.INTERNAL
            );
        }

        return this.imageTagGroupHasClassificationTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasClassificationTypeWithXLock(imageTagGroupId, classificationTypeId);
            if (relation !== null) {
                this.logger.error("image tag group with image_tag_group_id already has classification type with classification_type_id", {
                    imageTagGroupId,
                    classificationTypeId,
                });
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupId} already has classification type with classification_type_id ${classificationTypeId}`,
                    status.ALREADY_EXISTS
                );
            };
            await dm.createImageTagGroupHasClassificationType(imageTagGroupId, classificationTypeId);
        })
    }

    public async removeImageTagGroupHasClassificationType(
        imageTagGroupId: number,
        classificationTypeId: number
    ): Promise<void> {
        const imageTagGroup = await this.imageTagGroupDM.getImageTagGroup(imageTagGroupId);
        if (imageTagGroup === null) {
            this.logger.error("no image tag group with image_tag_group_id found", { imageTagGroupId });
            throw new ErrorWithStatus(
                `no image tag group with image_tag_group_id ${imageTagGroupId} found`,
                status.NOT_FOUND
            );
        }

        //check classification type is exist
        const { error: getClassificationTypeError, response: getClassificationTypeResponse } =
            await promisifyGRPCCall(
                this.modelServiceDM.getClassificationType.bind(this.modelServiceDM),
                { classificationTypeId: classificationTypeId }
            );     
        if (getClassificationTypeError !== null) {
            this.logger.error(
                "no classification type with classification_type_id found",
                { classificationTypeId },
            );
            throw new ErrorWithStatus(
                `no classification type with classification_type_id ${classificationTypeId} found`,
                status.NOT_FOUND
            );
        }
        if (getClassificationTypeResponse?.classificationType === undefined) {
            this.logger.error(
                "invalid response from model_service.getClassificationType()"
            );
            throw new ErrorWithStatus(
                "failed to get classification type by display name",
                status.INTERNAL
            );
        }

        return this.imageTagGroupHasClassificationTypeDM.withTransaction(async (dm) => {
            const relation = await dm.getImageTagGroupHasClassificationTypeWithXLock(imageTagGroupId, classificationTypeId);
            if (relation === null) {
                this.logger.error(
                    "image tag group with image_tag_group_id does not have image type with classification_type_id",
                    { imageTagGroupId, classificationTypeId }
                );
                throw new ErrorWithStatus(
                    `image tag group with image_tag_group_id ${imageTagGroupId} does not have image type with classification_type_id ${classificationTypeId}`,
                    status.FAILED_PRECONDITION
                );
            }
            await dm.deleteImageTagGroupHasClassificationType(imageTagGroupId, classificationTypeId);
        });
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

    private async getClassificationTypeList(classificationTypeIdList: number[]): Promise<ClassificationType[]> {
        const { error: getClassificationTypeError, response: getClassificationTypeResponse } = await promisifyGRPCCall(
            this.modelServiceDM.getClassificationTypeList.bind(this.modelServiceDM),
            { classificationTypeIdList: classificationTypeIdList }
        );
        if (getClassificationTypeError !== null) {
            this.logger.error(
                "failed to call model_service.getClassificationTypeList()",
                { error: getClassificationTypeError }
            );
            throw new ErrorWithStatus(
                `Failed to get classification types`,
                status.NOT_FOUND
            );
        }

        return getClassificationTypeResponse?.classificationTypeList || [];
    }
}

injected(
    ImageTagManagementOperatorImpl,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    IMAGE_TAG_GROUP_HAS_CLASSIFICATION_TYPE_DATA_ACCESSOR_TOKEN,
    MODEL_SERVICE_DM_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN = token<ImageTagManagementOperator>("ImageTagManagementOperator");
