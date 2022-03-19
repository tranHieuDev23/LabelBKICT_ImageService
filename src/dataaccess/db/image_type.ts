import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { ImageType } from "./models";

export interface ImageTypeDataAccessor {
    createImageType(
        displayName: string,
        hasPredictiveModel: boolean
    ): Promise<number>;
    getImageTypeList(): Promise<ImageType[]>;
    updateImageType(imageType: ImageType): Promise<void>;
    deleteImageType(id: number): Promise<void>;
}

const TabNameImageServiceImageType = "image_service_image_type_tab";
const ColNameImageServiceImageTypeID = "id";
const ColNameImageServiceImageTypeDisplayName = "display_name";
const ColNameImageServiceImageTypeHasPredictiveModel = "has_predictive_model";

export class ImageTypeDataAccessorImpl implements ImageTypeDataAccessor {
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createImageType(
        displayName: string,
        hasPredictiveModel: boolean
    ): Promise<number> {
        try {
            const rows = await this.knex
                .insert({
                    [ColNameImageServiceImageTypeDisplayName]: displayName,
                    [ColNameImageServiceImageTypeHasPredictiveModel]:
                        hasPredictiveModel,
                })
                .returning(ColNameImageServiceImageTypeID)
                .into(TabNameImageServiceImageType);
            return +rows[0][ColNameImageServiceImageTypeID];
        } catch (error) {
            this.logger.error("failed to create image type", {
                displayName,
                hasPredictiveModel,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getImageTypeList(): Promise<ImageType[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceImageType);
            return rows.map((row) => this.getImageTypeFromRow(row));
        } catch (error) {
            this.logger.error("failed to get image type list", { error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateImageType(imageType: ImageType): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceImageType)
                .update({
                    [ColNameImageServiceImageTypeDisplayName]:
                        imageType.displayName,
                    [ColNameImageServiceImageTypeHasPredictiveModel]:
                        imageType.hasPredictiveModel,
                })
                .where({
                    [ColNameImageServiceImageTypeID]: imageType.id,
                });
        } catch (error) {
            this.logger.error("failed to update image type", {
                imageType,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteImageType(id: number): Promise<void> {
        let deletedCount: number;
        try {
            deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceImageType)
                .where({
                    [ColNameImageServiceImageTypeID]: id,
                });
        } catch (error) {
            this.logger.error("failed to delete image type", {
                imageTypeID: id,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
        if (deletedCount === 0) {
            this.logger.error("no image type with image_type_id found", {
                imageTypeID: id,
            });
            throw new ErrorWithStatus(
                `no image type with image_type_id ${id} found`,
                status.NOT_FOUND
            );
        }
    }

    private getImageTypeFromRow(row: Record<string, any>): ImageType {
        return new ImageType(
            +row[ColNameImageServiceImageTypeID],
            row[ColNameImageServiceImageTypeDisplayName],
            row[ColNameImageServiceImageTypeHasPredictiveModel]
        );
    }
}

injected(ImageTypeDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const IMAGE_TYPE_DATA_ACCESSOR_TOKEN = token<ImageTypeDataAccessor>(
    "ImageTypeDataAccessor"
);
