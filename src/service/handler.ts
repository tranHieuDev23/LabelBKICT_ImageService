import { injected, token } from "brandi";
import { sendUnaryData, status } from "@grpc/grpc-js";
import { ImageServiceHandlers } from "../proto/gen/ImageService";
import { ErrorWithStatus } from "../utils";
import {
    ImageTypeManagementOperator,
    IMAGE_TYPE_MANAGEMENT_OPERATOR_TOKEN,
} from "../module/image_type";
import {
    ImageManagementOperator,
    IMAGE_MANAGEMENT_OPERATOR_TOKEN,
} from "../module/image";
import {
    ImageTagManagementOperator,
    IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN,
} from "../module/image_tag";
import {
    RegionManagementOperator,
    REGION_MANAGEMENT_OPERATOR_TOKEN,
} from "../module/region";
import { _ImageListSortOrder_Values } from "../proto/gen/ImageListSortOrder";

const DEFAULT_GET_IMAGE_LIST_LIMIT = 12;
const DEFAULT_GET_IMAGE_LIST_SORT_ORDER =
    _ImageListSortOrder_Values.UPLOAD_TIME_DESCENDING;

export class ImageServiceHandlersFactory {
    constructor(
        private readonly imageTypeManagementOperator: ImageTypeManagementOperator,
        private readonly imageTagManagementOperator: ImageTagManagementOperator,
        private readonly imageManagementOperator: ImageManagementOperator,
        private readonly regionManagementOperator: RegionManagementOperator
    ) {}

    public getImageServiceHandlers(): ImageServiceHandlers {
        const handler: ImageServiceHandlers = {
            AddImageTypeToImageTagGroup: async (call, callback) => {
                const req = call.request;
                if (req.imageTagGroupId === undefined) {
                    return callback({
                        message: "image_tag_group_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageTypeId === undefined) {
                    return callback({
                        message: "image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTagManagementOperator.addImageTypeToImageTagGroup(
                        req.imageTagGroupId,
                        req.imageTypeId
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            AddImageTagToImage: async (call, callback) => {
                const req = call.request;
                if (req.imageId === undefined) {
                    return callback({
                        message: "image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageTagId === undefined) {
                    return callback({
                        message: "image_tag_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageManagementOperator.addImageTagToImage(
                        req.imageId,
                        req.imageTagId
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateImage: async (call, callback) => {
                const req = call.request;
                if (req.uploadedByUserId === undefined) {
                    return callback({
                        message: "uploaded_by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageData === undefined) {
                    return callback({
                        message: "image_data is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                const originalFileName = req.originalFileName || "";
                const description = req.description || "";

                try {
                    const image =
                        await this.imageManagementOperator.createImage(
                            req.uploadedByUserId,
                            originalFileName,
                            req.imageData,
                            description,
                            req.imageTypeId
                        );
                    callback(null, { image });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateImageTag: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTagGroupId === undefined) {
                    return callback({
                        message: "of_image_tag_group_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.displayName === undefined) {
                    return callback({
                        message: "display_name is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageTag =
                        await this.imageTagManagementOperator.createImageTag(
                            req.ofImageTagGroupId,
                            req.displayName
                        );
                    callback(null, { imageTag });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateImageTagGroup: async (call, callback) => {
                const req = call.request;
                if (req.displayName === undefined) {
                    return callback({
                        message: "display_name is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.isSingleValue === undefined) {
                    return callback({
                        message: "is_single_value is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageTagGroup =
                        await this.imageTagManagementOperator.createImageTagGroup(
                            req.displayName,
                            req.isSingleValue
                        );
                    callback(null, { imageTagGroup });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateImageType: async (call, callback) => {
                const req = call.request;
                if (req.displayName === undefined) {
                    return callback({
                        message: "display_name is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.hasPredictiveModel === undefined) {
                    return callback({
                        message: "has_predictive_model is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageType =
                        await this.imageTypeManagementOperator.createImageType(
                            req.displayName,
                            req.hasPredictiveModel
                        );
                    callback(null, { imageType });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateRegion: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.drawnByUserId === undefined) {
                    return callback({
                        message: "drawn_by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.labeledByUserId === undefined) {
                    return callback({
                        message: "labeled_by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.border === undefined) {
                    return callback({
                        message: "border is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.holes === undefined) {
                    return callback({
                        message: "holes is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const region =
                        await this.regionManagementOperator.createRegion(
                            req.ofImageId,
                            req.drawnByUserId,
                            req.labeledByUserId,
                            req.border,
                            req.holes,
                            req.labelId
                        );
                    callback(null, { region });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            CreateRegionLabel: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTypeId === undefined) {
                    return callback({
                        message: "of_image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.displayName === undefined) {
                    return callback({
                        message: "display_name is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.color === undefined) {
                    return callback({
                        message: "color is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const regionLabel =
                        await this.imageTypeManagementOperator.createRegionLabel(
                            req.ofImageTypeId,
                            req.displayName,
                            req.color
                        );
                    callback(null, { regionLabel });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteImage: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageManagementOperator.deleteImage(req.id);
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteImageList: async (call, callback) => {
                const req = call.request;
                try {
                    await this.imageManagementOperator.deleteImageList(
                        req.idList || []
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteImageTag: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTagGroupId === undefined) {
                    return callback({
                        message: "of_image_tag_group_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTagManagementOperator.deleteImageTag(
                        req.ofImageTagGroupId,
                        req.id
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteImageTagGroup: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTagManagementOperator.deleteImageTagGroup(
                        req.id
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteImageType: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTypeManagementOperator.deleteImageType(
                        req.id
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteRegion: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.regionId === undefined) {
                    return callback({
                        message: "region_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.regionManagementOperator.deleteRegion(
                        req.ofImageId,
                        req.regionId
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            DeleteRegionLabel: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTypeId === undefined) {
                    return callback({
                        message: "of_image_type is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTypeManagementOperator.deleteRegionLabel(
                        req.ofImageTypeId,
                        req.id
                    );
                    callback(null, {});
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetImage: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                const withImageTag = req.withImageTag || false;
                const withRegion = req.withRegion || false;

                try {
                    const { image, imageTagList, regionList } =
                        await this.imageManagementOperator.getImage(
                            req.id,
                            withImageTag,
                            withRegion
                        );
                    callback(null, { image, imageTagList, regionList });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetImageList: async (call, callback) => {
                const req = call.request;
                const offset = req.offset || 0;
                const limit = req.limit || DEFAULT_GET_IMAGE_LIST_LIMIT;
                const sortOrder =
                    req.sortOrder || DEFAULT_GET_IMAGE_LIST_SORT_ORDER;
                const withImageTag = req.withImageTag || false;
                const withRegion = req.withRegion || false;

                try {
                    const { imageList, imageTagList, regionList } =
                        await this.imageManagementOperator.getImageList(
                            offset,
                            limit,
                            sortOrder,
                            req.filterOptions,
                            withImageTag,
                            withRegion
                        );

                    let imageTagListOfImageList = undefined;
                    if (withImageTag) {
                        imageTagListOfImageList = imageTagList?.map(
                            (imageTagSublist) => {
                                return {
                                    imageTagList: imageTagSublist,
                                };
                            }
                        );
                    }

                    let regionListOfImageList = undefined;
                    if (withRegion) {
                        regionListOfImageList = regionList?.map(
                            (regionSublist) => {
                                return {
                                    regionList: regionSublist,
                                };
                            }
                        );
                    }

                    callback(null, {
                        imageList,
                        imageTagListOfImageList,
                        regionListOfImageList,
                    });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetImageTagGroupList: async (call, callback) => {
                const req = call.request;
                const withImageTag = req.withImageTag || false;
                const withImageType = req.withImageType || false;

                try {
                    const { imageTagGroupList, imageTagList, imageTypeList } =
                        await this.imageTagManagementOperator.getImageTagGroupList(
                            withImageTag,
                            withImageType
                        );

                    let imageTagListOfImageTagGroupList = undefined;
                    if (withImageTag) {
                        imageTagListOfImageTagGroupList = imageTagList?.map(
                            (imageTagSublist) => {
                                return {
                                    imageTagList: imageTagSublist,
                                };
                            }
                        );
                    }

                    let imageTypeListOfImageTagGroupList = undefined;
                    if (withImageType) {
                        imageTypeListOfImageTagGroupList = imageTypeList?.map(
                            (imageTypeSubList) => {
                                return {
                                    imageTypeList: imageTypeSubList,
                                };
                            }
                        );
                    }

                    callback(null, {
                        imageTagGroupList,
                        imageTagListOfImageTagGroupList,
                        imageTypeListOfImageTagGroupList,
                    });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetImageTagGroupListOfImageType: async (call, callback) => {
                const req = call.request;
                if (req.imageTypeId === undefined) {
                    return callback({
                        message: "image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const { imageTagGroupList, imageTagList } =
                        await this.imageTagManagementOperator.getImageTagGroupListOfImageType(
                            req.imageTypeId
                        );

                    const imageTagListOfImageTagGroupList = imageTagList?.map(
                        (imageTagSublist) => {
                            return {
                                imageTagList: imageTagSublist,
                            };
                        }
                    );

                    callback(null, {
                        imageTagGroupList,
                        imageTagListOfImageTagGroupList,
                    });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetImageTypeList: async (call, callback) => {
                const req = call.request;
                const withRegionLabel = req.withRegionLabel || false;

                try {
                    const { imageTypeList, regionLabelList } =
                        await this.imageTypeManagementOperator.getImageTypeList(
                            withRegionLabel
                        );

                    let regionLabelListOfImageTypeList = undefined;
                    if (withRegionLabel) {
                        regionLabelListOfImageTypeList = regionLabelList?.map(
                            (regionLabelSublist) => {
                                return {
                                    regionLabelList: regionLabelSublist,
                                };
                            }
                        );
                    }

                    callback(null, {
                        imageTypeList,
                        regionLabelListOfImageTypeList,
                    });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetRegionOperationLogList: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.regionId === undefined) {
                    return callback({
                        message: "region_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const regionOperationLogList =
                        await this.regionManagementOperator.getRegionOperationLogList(
                            req.ofImageId,
                            req.regionId
                        );
                    callback(null, { regionOperationLogList });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            GetRegionSnapshotListOfImage: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.atStatus === undefined) {
                    return callback({
                        message: "at_status is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const regionList =
                        await this.imageManagementOperator.getRegionSnapshotListOfImage(
                            req.ofImageId,
                            req.atStatus
                        );
                    callback(null, { regionList });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            RemoveImageTagFromImage: async (call, callback) => {
                const req = call.request;
                if (req.imageId === undefined) {
                    return callback({
                        message: "image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageTagId === undefined) {
                    return callback({
                        message: "image_tag_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageManagementOperator.removeImageTagFromImage(
                        req.imageId,
                        req.imageTagId
                    );
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            RemoveImageTypeFromImageTagGroup: async (call, callback) => {
                const req = call.request;
                if (req.imageTagGroupId === undefined) {
                    return callback({
                        message: "image_tag_group_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageTypeId === undefined) {
                    return callback({
                        message: "image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageTagManagementOperator.removeImageTypeFromImageTagGroup(
                        req.imageTagGroupId,
                        req.imageTypeId
                    );
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageImageType: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.imageTypeId === undefined) {
                    return callback({
                        message: "image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageManagementOperator.updateImageImageType(
                        req.id,
                        req.imageTypeId
                    );
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageListImageType: async (call, callback) => {
                const req = call.request;
                const imageIDList = req.imageIdList || [];
                if (req.imageTypeId === undefined) {
                    return callback({
                        message: "image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    await this.imageManagementOperator.updateImageListImageType(
                        imageIDList,
                        req.imageTypeId
                    );
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageMetadata: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const image =
                        await this.imageManagementOperator.updateImageMetadata(
                            req.id,
                            req.description
                        );
                    callback(null, { image });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageStatus: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.byUserId === undefined) {
                    return callback({
                        message: "by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.status === undefined) {
                    return callback({
                        message: "status is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const image =
                        await this.imageManagementOperator.updateImageStatus(
                            req.id,
                            req.status,
                            req.byUserId
                        );
                    callback(null, { image });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageTag: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTagGroupId === undefined) {
                    return callback({
                        message: "of_image_tag_group_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageTag =
                        await this.imageTagManagementOperator.updateImageTag(
                            req.ofImageTagGroupId,
                            req.id,
                            req.displayName
                        );
                    callback(null, { imageTag });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageTagGroup: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageTagGroup =
                        await this.imageTagManagementOperator.updateImageTagGroup(
                            req.id,
                            req.displayName,
                            req.isSingleValue
                        );
                    callback(null, { imageTagGroup });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateImageType: async (call, callback) => {
                const req = call.request;
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const imageType =
                        await this.imageTypeManagementOperator.updateImageType(
                            req.id,
                            req.displayName,
                            req.hasPredictiveModel
                        );
                    callback(null, { imageType });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateRegionBoundary: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.regionId === undefined) {
                    return callback({
                        message: "region_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.drawnByUserId === undefined) {
                    return callback({
                        message: "drawn_by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.border === undefined) {
                    return callback({
                        message: "border is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.holes === undefined) {
                    return callback({
                        message: "holes is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const region =
                        await this.regionManagementOperator.updateRegionBoundary(
                            req.ofImageId,
                            req.regionId,
                            req.drawnByUserId,
                            req.border,
                            req.holes
                        );
                    callback(null, { region });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateRegionLabel: async (call, callback) => {
                const req = call.request;
                if (req.ofImageTypeId === undefined) {
                    return callback({
                        message: "of_image_type_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.id === undefined) {
                    return callback({
                        message: "id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const regionLabel =
                        await this.imageTypeManagementOperator.updateRegionLabel(
                            req.ofImageTypeId,
                            req.id,
                            req.displayName,
                            req.color
                        );
                    callback(null, { regionLabel });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },

            UpdateRegionRegionLabel: async (call, callback) => {
                const req = call.request;
                if (req.ofImageId === undefined) {
                    return callback({
                        message: "of_image_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.regionId === undefined) {
                    return callback({
                        message: "region_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.labeledByUserId === undefined) {
                    return callback({
                        message: "labeled_by_user_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }
                if (req.labelId === undefined) {
                    return callback({
                        message: "label_id is required",
                        code: status.INVALID_ARGUMENT,
                    });
                }

                try {
                    const region =
                        await this.regionManagementOperator.updateRegionLabel(
                            req.ofImageId,
                            req.regionId,
                            req.labeledByUserId,
                            req.labelId
                        );
                    callback(null, { region });
                } catch (e) {
                    this.handleError(e, callback);
                }
            },
        };
        return handler;
    }

    private handleError(e: unknown, callback: sendUnaryData<any>) {
        if (e instanceof ErrorWithStatus) {
            return callback({
                message: e.message,
                code: e.status,
            });
        } else if (e instanceof Error) {
            return callback({
                message: e.message,
                code: status.INTERNAL,
            });
        } else {
            return callback({
                code: status.INTERNAL,
            });
        }
    }
}

injected(
    ImageServiceHandlersFactory,
    IMAGE_TYPE_MANAGEMENT_OPERATOR_TOKEN,
    IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN,
    IMAGE_MANAGEMENT_OPERATOR_TOKEN,
    REGION_MANAGEMENT_OPERATOR_TOKEN
);

export const IMAGE_SERVICE_HANDLERS_FACTORY_TOKEN =
    token<ImageServiceHandlersFactory>("ImageServiceHandlersFactory");
