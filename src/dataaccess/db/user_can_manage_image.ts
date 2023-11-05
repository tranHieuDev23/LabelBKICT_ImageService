import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class UserCanManageImage {
    constructor(public userId: number, public imageId: number, public canEdit: boolean) {}
}

export interface UserCanManageImageDataAccessor {
    createUserCanManageImage(userId: number, imageId: number, canEdit: boolean): Promise<void>;
    getUserCanManageImageCountOfUserId(userId: number): Promise<number>;
    getManageableImageIdListOfUserId(userId: number): Promise<number[]>;
    getUserCanManageImage(userId: number, imageId: number): Promise<UserCanManageImage | null>;
    getUserCanManageImageWithXLock(userId: number, imageId: number): Promise<UserCanManageImage | null>;
    updateUserCanManageImage(userCanManageImage: UserCanManageImage): Promise<void>;
    deleteUserCanManageImage(userId: number, imageId: number): Promise<void>;
    getUserCanManageImageListOfImageId(imageId: number): Promise<UserCanManageImage[]>;
    withTransaction<T>(executeFunc: (dataAccessor: UserCanManageImageDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceUserCanManageImage = "image_service_user_can_manage_image";
const ColNameImageServiceUserCanManageImageUserId = "user_id";
const ColNameImageServiceUserCanManageImageImageId = "image_id";
const ColNameImageServiceUserCanManageImageCanEdit = "can_edit";

const TabNameImageServiceUserCanManageUserImage = "image_service_user_can_manage_user_image";
const ColNameImageServiceUserCanManageUserImageUserId = "user_id";
const ColNameImageServiceUserCanManageUserImageImageOfUserId = "image_of_user_id";

const TabNameImageServiceImage = "image_service_image_tab";
const ColNameImageServiceImageId = "image_id";
const ColNameImageServiceImageUploadedByUserId = "uploaded_by_user_id";

export class UserCanManageImageDataAccessorImpl implements UserCanManageImageDataAccessor {
    constructor(private readonly knex: Knex<any, any[]>, private readonly logger: Logger) {}

    public async createUserCanManageImage(userId: number, imageId: number, canEdit: boolean): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                    [ColNameImageServiceUserCanManageImageImageId]: imageId,
                    [ColNameImageServiceUserCanManageImageCanEdit]: canEdit,
                })
                .into(TabNameImageServiceUserCanManageImage);
        } catch (error) {
            this.logger.error("failed to create user can manage image relation", {
                userId,
                imageId,
                canEdit,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageImageCountOfUserId(userId: number): Promise<number> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                });
            return +(rows[0] as any)["count"];
        } catch (error) {
            this.logger.error("failed to get user can manage image relation count", { userId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getManageableImageIdListOfUserId(userId: number): Promise<number[]> {
        try {
            const rows = await this.knex
                .select([ColNameImageServiceUserCanManageImageImageId])
                .distinct()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                })
                .union((qb) => {
                    return qb
                        .select([ColNameImageServiceImageId])
                        .distinct()
                        .from(TabNameImageServiceImage)
                        .leftJoin(
                            TabNameImageServiceUserCanManageUserImage,
                            ColNameImageServiceImageUploadedByUserId,
                            ColNameImageServiceUserCanManageUserImageImageOfUserId
                        )
                        .where(ColNameImageServiceUserCanManageUserImageUserId, "=", userId)
                        .orWhere(ColNameImageServiceImageUploadedByUserId, "=", userId);
                });
            return rows.map((row) => +row[ColNameImageServiceUserCanManageImageImageId]);
        } catch (error) {
            this.logger.error("failed to get manageable image id list of user", {
                userId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageImage(userId: number, imageId: number): Promise<UserCanManageImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                    [ColNameImageServiceUserCanManageImageImageId]: imageId,
                });
            if (rows.length === 0) {
                this.logger.error("no user can manage image relation found", { userId, imageId: imageId });
                return null;
            }
            return this.getUserCanManageImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user can manage image relation", {
                userId,
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageImageWithXLock(userId: number, imageId: number): Promise<UserCanManageImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                    [ColNameImageServiceUserCanManageImageImageId]: imageId,
                })
                .forUpdate();
            if (rows.length === 0) {
                this.logger.error("no user can manage image relation found", { userId, imageId });
                return null;
            }
            return this.getUserCanManageImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user can manage image relation", { userId, imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateUserCanManageImage(userCanManageImage: UserCanManageImage): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceUserCanManageImage)
                .update({
                    [ColNameImageServiceUserCanManageImageCanEdit]: userCanManageImage.canEdit,
                })
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userCanManageImage.userId,
                    [ColNameImageServiceUserCanManageImageImageId]: userCanManageImage.imageId,
                });
        } catch (error) {
            this.logger.error("failed to update user can manage image relation", {
                userCanManageImage,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteUserCanManageImage(userId: number, imageId: number): Promise<void> {
        try {
            const deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageUserId]: userId,
                    [ColNameImageServiceUserCanManageImageImageId]: imageId,
                });
            if (deletedCount === 0) {
                this.logger.error("no user can manage image relation found", { userId, imageId });
                throw new ErrorWithStatus("no user can manage image relation found", status.NOT_FOUND);
            }
        } catch (error) {
            this.logger.error("failed to delete user can manage image relation", { userId, imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageImageListOfImageId(imageId: number): Promise<UserCanManageImage[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanManageImage)
                .where({
                    [ColNameImageServiceUserCanManageImageImageId]: imageId,
                });
            return rows.map((row) => this.getUserCanManageImageFromRow(row));
        } catch (error) {
            this.logger.error("failed to get user can manage image relation of image id", {
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: UserCanManageImageDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new UserCanManageImageDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private getUserCanManageImageFromRow(row: Record<string, any>): UserCanManageImage {
        return new UserCanManageImage(
            +row[ColNameImageServiceUserCanManageImageUserId],
            +row[ColNameImageServiceUserCanManageImageImageId],
            row[ColNameImageServiceUserCanManageImageCanEdit]
        );
    }
}

injected(UserCanManageImageDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const USER_CAN_MANAGE_IMAGE_DATA_ACCESSOR_TOKEN = token<UserCanManageImageDataAccessor>(
    "UserCanManageImageDataAccessor"
);
