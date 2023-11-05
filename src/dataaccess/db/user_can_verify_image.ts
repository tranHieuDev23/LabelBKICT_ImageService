import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";

export class UserCanVerifyImage {
    constructor(public userId: number, public imageId: number) {}
}

export interface UserCanVerifyImageDataAccessor {
    createUserCanVerifyImage(userId: number, imageId: number): Promise<void>;
    getUserCanVerifyImageCountOfUserId(userId: number): Promise<number>;
    getVerifiableImageIdListOfUserId(userId: number): Promise<number[]>;
    getUserCanVerifyImage(userId: number, imageId: number): Promise<UserCanVerifyImage | null>;
    getUserCanVerifyImageWithXLock(userId: number, imageId: number): Promise<UserCanVerifyImage | null>;
    deleteUserCanVerifyImage(userId: number, imageId: number): Promise<void>;
    getUserCanVerifyImageListOfImageId(imageId: number): Promise<UserCanVerifyImage[]>;
    withTransaction<T>(executeFunc: (dataAccessor: UserCanVerifyImageDataAccessor) => Promise<T>): Promise<T>;
}

const TabNameImageServiceUserCanVerifyImage = "image_service_user_can_verify_image";
const ColNameImageServiceUserCanVerifyImageUserId = "user_id";
const ColNameImageServiceUserCanVerifyImageImageId = "image_id";

const TabNameImageServiceUserCanVerifyUserImage = "image_service_user_can_verify_user_image";
const ColNameImageServiceUserCanVerifyUserImageUserId = "user_id";
const ColNameImageServiceUserCanVerifyUserImageImageOfUserId = "image_of_user_id";

const TabNameImageServiceImage = "image_service_image_tab";
const ColNameImageServiceImageId = "image_id";
const ColNameImageServiceImageUploadedByUserId = "uploaded_by_user_id";
const ColNameImageServiceImageStatus = "status";
export class UserCanVerifyImageDataAccessorImpl implements UserCanVerifyImageDataAccessor {
    constructor(private readonly knex: Knex<any, any[]>, private readonly logger: Logger) {}

    public async createUserCanVerifyImage(userId: number, imageId: number): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyImageImageId]: imageId,
                })
                .into(TabNameImageServiceUserCanVerifyImage);
        } catch (error) {
            this.logger.error("failed to create user can verify image relation", {
                userId,
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyImageCountOfUserId(userId: number): Promise<number> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                });
            return +(rows[0] as any)["count"];
        } catch (error) {
            this.logger.error("failed to get user can verify image relation count", { userId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getVerifiableImageIdListOfUserId(userId: number): Promise<number[]> {
        try {
            const rows = await this.knex
                .select([ColNameImageServiceUserCanVerifyImageImageId])
                .distinct()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                })
                .union((qb) => {
                    return qb
                        .select([ColNameImageServiceImageId])
                        .distinct()
                        .from(TabNameImageServiceImage)
                        .join(
                            TabNameImageServiceUserCanVerifyUserImage,
                            ColNameImageServiceImageUploadedByUserId,
                            ColNameImageServiceUserCanVerifyUserImageImageOfUserId
                        )
                        .where(ColNameImageServiceUserCanVerifyUserImageUserId, "=", userId)
                        .andWhere((qb) => {
                            return qb.whereIn(ColNameImageServiceImageStatus, [
                                _ImageStatus_Values.PUBLISHED,
                                _ImageStatus_Values.VERIFIED,
                            ]);
                        });
                });
            return rows.map((row) => +row[ColNameImageServiceUserCanVerifyImageImageId]);
        } catch (error) {
            this.logger.error("failed to get verifiable image id list of user", {
                userId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyImage(userId: number, imageId: number): Promise<UserCanVerifyImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyImageImageId]: imageId,
                });
            if (rows.length === 0) {
                this.logger.error("no user can verify image relation found", { userId, imageId });
                return null;
            }
            return this.getUserCanVerifyImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user can verify image relation", { userId, imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyImageWithXLock(userId: number, imageId: number): Promise<UserCanVerifyImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyImageImageId]: imageId,
                })
                .forUpdate();
            if (rows.length === 0) {
                this.logger.error("no user can verify image relation found", { userId, imageId });
                return null;
            }
            return this.getUserCanVerifyImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user can verify image relation", { userId, imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteUserCanVerifyImage(userId: number, imageId: number): Promise<void> {
        try {
            const deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyImageImageId]: imageId,
                });
            if (deletedCount === 0) {
                this.logger.error("no user can verify image relation found", { userId, imageId });
                throw new ErrorWithStatus("no user can verify image relation found", status.NOT_FOUND);
            }
        } catch (error) {
            this.logger.error("failed to delete user can verify image relation", { userId, imageId, error });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyImageListOfImageId(imageId: number): Promise<UserCanVerifyImage[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserCanVerifyImage)
                .where({
                    [ColNameImageServiceUserCanVerifyImageImageId]: imageId,
                });
            return rows.map((row) => this.getUserCanVerifyImageFromRow(row));
        } catch (error) {
            this.logger.error("failed to get user can verify image relation of image id", {
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (dataAccessor: UserCanVerifyImageDataAccessor) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new UserCanVerifyImageDataAccessorImpl(tx, this.logger);
            return executeFunc(txDataAccessor);
        });
    }

    private getUserCanVerifyImageFromRow(row: Record<string, any>): UserCanVerifyImage {
        return new UserCanVerifyImage(
            +row[ColNameImageServiceUserCanVerifyImageUserId],
            +row[ColNameImageServiceUserCanVerifyImageImageId]
        );
    }
}

injected(UserCanVerifyImageDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const USER_CAN_VERIFY_IMAGE_DATA_ACCESSOR_TOKEN = token<UserCanVerifyImageDataAccessor>(
    "UserCanVerifyImageDataAccessor"
);
