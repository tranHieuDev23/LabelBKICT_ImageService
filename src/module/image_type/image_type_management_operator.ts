import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import validator from "validator";
import { Logger } from "winston";
import {
    ImageTypeDataAccessor,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    RegionLabelDataAccessor,
    REGION_LABEL_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { ImageType } from "../../proto/gen/ImageType";
import { RegionLabel } from "../../proto/gen/RegionLabel";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";

export interface ImageTypeManagementOperator {
    createImageType(
        displayName: string,
        hasPredictiveModel: boolean
    ): Promise<ImageType>;
    getImageTypeList(withRegionLabel: boolean): Promise<{
        imageTypeList: ImageType[];
        regionLabelList: RegionLabel[][] | null;
    }>;
    updateImageType(
        id: number,
        displayName: string,
        hasPredictiveModel: boolean
    ): Promise<ImageType>;
    deleteImageType(id: number): Promise<void>;
    createRegionLabel(
        ofImageTypeID: number,
        displayName: string,
        color: string
    ): Promise<RegionLabel>;
    updateRegionLabel(
        ofImageTypeID: number,
        id: number,
        displayName: string | undefined,
        color: string | undefined
    ): Promise<RegionLabel>;
    deleteRegionLabel(ofImageTypeID: number, id: number): Promise<void>;
}

export class ImageTypeManagementOperatorImpl
    implements ImageTypeManagementOperator
{
    constructor(
        private readonly imageTypeDM: ImageTypeDataAccessor,
        private readonly regionLabelDM: RegionLabelDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createImageType(
        displayName: string,
        hasPredictiveModel: boolean
    ): Promise<ImageType> {
        displayName = this.sanitizeImageTypeDisplayName(displayName);
        if (!this.isValidImageTypeDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(
                `invalid display name ${displayName}`,
                status.INVALID_ARGUMENT
            );
        }

        const createdImageTypeID = await this.imageTypeDM.createImageType(
            displayName,
            hasPredictiveModel
        );
        return {
            id: createdImageTypeID,
            displayName: displayName,
            hasPredictiveModel: hasPredictiveModel,
        };
    }

    public async getImageTypeList(withRegionLabel: boolean): Promise<{
        imageTypeList: ImageType[];
        regionLabelList: RegionLabel[][] | null;
    }> {
        const imageTypeList = await this.imageTypeDM.getImageTypeList();
        if (!withRegionLabel) {
            return {
                imageTypeList: imageTypeList.map((imageType) => {
                    return {
                        id: imageType.id,
                        displayName: imageType.displayName,
                        hasPredictiveModel: imageType.hasPredictiveModel,
                    };
                }),
                regionLabelList: null,
            };
        }

        const imageTypeIDList = imageTypeList.map((imageType) => imageType.id);
        const regionLabelList =
            await this.regionLabelDM.getRegionLabelListOfImageTypeIDList(
                imageTypeIDList
            );
        return {
            imageTypeList: imageTypeList.map((imageType) => {
                return {
                    id: imageType.id,
                    displayName: imageType.displayName,
                    hasPredictiveModel: imageType.hasPredictiveModel,
                };
            }),
            regionLabelList: regionLabelList.map((list) =>
                list.map((regionLabel) => {
                    return {
                        id: regionLabel.id,
                        displayName: regionLabel.displayName,
                        color: regionLabel.color,
                    };
                })
            ),
        };
    }

    public async updateImageType(
        id: number,
        displayName: string | undefined,
        hasPredictiveModel: boolean | undefined
    ): Promise<ImageType> {
        if (displayName !== undefined) {
            displayName = this.sanitizeImageTypeDisplayName(displayName);
            if (!this.isValidImageTypeDisplayName(displayName)) {
                this.logger.error("invalid display name", { displayName });
                throw new ErrorWithStatus(
                    `invalid display name ${displayName}`,
                    status.INVALID_ARGUMENT
                );
            }
        }

        return this.imageTypeDM.withTransaction(async (dm) => {
            const imageType = await dm.getImageTypeWithXLock(id);
            if (imageType === null) {
                this.logger.error("no image type with image_type_id found", {
                    imageTypeID: id,
                });
                throw new ErrorWithStatus(
                    `no image type with image_type_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (displayName !== undefined) {
                imageType.displayName = displayName;
            }
            if (hasPredictiveModel !== undefined) {
                imageType.hasPredictiveModel = hasPredictiveModel;
            }

            await dm.updateImageType(imageType);
            return imageType;
        });
    }

    public async deleteImageType(id: number): Promise<void> {
        return this.imageTypeDM.deleteImageType(id);
    }

    public async createRegionLabel(
        ofImageTypeID: number,
        displayName: string,
        color: string
    ): Promise<RegionLabel> {
        displayName = this.sanitizeRegionLabelDisplayName(displayName);
        if (!this.isValidRegionLabelDisplayName(displayName)) {
            this.logger.error("invalid display name", { displayName });
            throw new ErrorWithStatus(
                `invalid display name ${displayName}`,
                status.INVALID_ARGUMENT
            );
        }

        if (!this.isValidRegionLabelColor(color)) {
            this.logger.error("invalid color", { color });
            throw new ErrorWithStatus(
                `invalid display name ${color}`,
                status.INVALID_ARGUMENT
            );
        }

        const imageType = await this.imageTypeDM.getImageTypeWithXLock(
            ofImageTypeID
        );
        if (imageType === null) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeID: ofImageTypeID,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${ofImageTypeID} found`,
                status.NOT_FOUND
            );
        }

        const createdRegionLabelID = await this.regionLabelDM.createRegionLabel(
            ofImageTypeID,
            displayName,
            color
        );
        return {
            id: createdRegionLabelID,
            displayName: displayName,
            color: color,
        };
    }

    public async updateRegionLabel(
        ofImageTypeID: number,
        id: number,
        displayName: string | undefined,
        color: string | undefined
    ): Promise<RegionLabel> {
        if (displayName !== undefined) {
            displayName = this.sanitizeRegionLabelDisplayName(displayName);
            if (!this.isValidRegionLabelDisplayName(displayName)) {
                this.logger.error("invalid display name", { displayName });
                throw new ErrorWithStatus(
                    `invalid display name ${displayName}`,
                    status.INVALID_ARGUMENT
                );
            }
        }

        if (color !== undefined) {
            if (!this.isValidRegionLabelColor(color)) {
                this.logger.error("invalid color", { color });
                throw new ErrorWithStatus(
                    `invalid display name ${color}`,
                    status.INVALID_ARGUMENT
                );
            }
        }

        return this.regionLabelDM.withTransaction(async (dm) => {
            const regionLabel = await dm.getRegionLabelWithXLock(id);
            if (regionLabel === null) {
                this.logger.error(
                    "no region label with region_label_id found",
                    { regionLabelID: id }
                );
                throw new ErrorWithStatus(
                    `no region label with region_label_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (regionLabel.ofImageTypeID !== ofImageTypeID) {
                this.logger.error(
                    "image type with image_type_id does not have region label",
                    { imageTypeID: ofImageTypeID, regionLabelID: id }
                );
                throw new ErrorWithStatus(
                    `image type with image_type_id ${ofImageTypeID} does not have region label ${id}`,
                    status.NOT_FOUND
                );
            }

            if (displayName !== undefined) {
                regionLabel.displayName = displayName;
            }
            if (color !== undefined) {
                regionLabel.color = color;
            }

            await dm.updateRegionLabel(regionLabel);
            return {
                id: id,
                displayName: displayName,
                color: color,
            };
        });
    }

    public async deleteRegionLabel(
        ofImageTypeID: number,
        id: number
    ): Promise<void> {
        return this.regionLabelDM.withTransaction(async (dm) => {
            const regionLabel = await dm.getRegionLabelWithXLock(id);
            if (regionLabel === null) {
                this.logger.error(
                    "no region label with region_label_id found",
                    { regionLabelID: id }
                );
                throw new ErrorWithStatus(
                    `no region label with region_label_id ${id} found`,
                    status.NOT_FOUND
                );
            }

            if (regionLabel.ofImageTypeID !== ofImageTypeID) {
                this.logger.error(
                    "image type with image_type_id does not have region label",
                    { imageTypeID: ofImageTypeID, regionLabelID: id }
                );
                throw new ErrorWithStatus(
                    `image type with image_type_id ${ofImageTypeID} does not have region label ${id}`,
                    status.NOT_FOUND
                );
            }

            await dm.deleteRegionLabel(id);
        });
    }

    private sanitizeImageTypeDisplayName(displayName: string): string {
        return validator.escape(validator.trim(displayName));
    }

    private isValidImageTypeDisplayName(displayName: string): boolean {
        return validator.isLength(displayName, { min: 1, max: 256 });
    }

    private sanitizeRegionLabelDisplayName(displayName: string): string {
        return validator.escape(validator.trim(displayName));
    }

    private isValidRegionLabelDisplayName(displayName: string): boolean {
        return validator.isLength(displayName, { min: 1, max: 256 });
    }

    private isValidRegionLabelColor(color: string): boolean {
        return /^#[0-9A-F]{6}$/.test(color);
    }
}

injected(
    ImageTypeManagementOperatorImpl,
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    REGION_LABEL_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const IMAGE_TYPE_MANAGEMENT_OPERATOR_TOKEN =
    token<ImageTypeManagementOperator>("ImageTypeManagementOperator");
