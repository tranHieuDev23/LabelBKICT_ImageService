import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class UserCanManageUserImage {
    constructor(
        public userId: number,
        public imageOfUserId: number,
        public canEdit: boolean
    ) {}
}

export interface UserCanManageUserImageDataAccessor {
    createUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean
    ): Promise<void>;
    getUserCanManageUserImageCountOfUserId(userId: number): Promise<number>;
    getUserCanManageUserImageListOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<UserCanManageUserImage[]>;
    getUserCanManageUserImageWithXLock(
        userId: number,
        imageOfUserId: number
    ): Promise<UserCanManageUserImage | null>;
    updateUserCanManageUserImage(
        userCanManageUserImage: UserCanManageUserImage
    ): Promise<void>;
    deleteUserCanManageUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: UserCanManageUserImageDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceUserCanManageUserImage =
    "image_service_user_can_manage_user_image";
const ColNameImageServiceUserCanManageUserImageUserId = "user_id";
const ColNameImageServiceUserCanManageUserImageImageOfUserId =
    "image_of_user_id";
const ColNameImageServiceUserCanManageUserImageCanEdit = "can_edit";

export class UserCanManageUserImageDataAccessorImpl
    implements UserCanManageUserImageDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceUserCanManageUserImageUserId]: userId,
                    [ColNameImageServiceUserCanManageUserImageImageOfUserId]:
                        imageOfUserId,
                    [ColNameImageServiceUserCanManageUserImageCanEdit]: canEdit,
                })
                .into(TabNameImageServiceUserCanManageUserImage);
        } catch (error) {
            this.logger.error(
                "failed to create user can manage user image relation",
                { userId, imageOfUserId, canEdit, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageUserImageCountOfUserId(
        userId: number
    ): Promise<number> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanManageUserImage)
                .where({
                    [ColNameImageServiceUserCanManageUserImageUserId]: userId,
                });
            return +rows[0];
        } catch (error) {
            this.logger.error(
                "failed to get user can manage user image relation count",
                { userId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageUserImageListOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<UserCanManageUserImage[]> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanManageUserImage)
                .where({
                    [ColNameImageServiceUserCanManageUserImageUserId]: userId,
                })
                .orderBy(
                    ColNameImageServiceUserCanManageUserImageImageOfUserId,
                    "asc"
                )
                .offset(offset)
                .limit(limit);
            return rows.map((row) =>
                this.getUserCanManageUserImageFromRow(row)
            );
        } catch (error) {
            this.logger.error(
                "failed to get user can manage user image relation list",
                { userId, offset, limit, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanManageUserImageWithXLock(
        userId: number,
        imageOfUserId: number
    ): Promise<UserCanManageUserImage | null> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanManageUserImage)
                .where({
                    [ColNameImageServiceUserCanManageUserImageUserId]: userId,
                    [ColNameImageServiceUserCanManageUserImageImageOfUserId]:
                        imageOfUserId,
                });
            if (rows.length === 0) {
                this.logger.error(
                    "no user can manage user image relation found",
                    { userId, imageOfUserId }
                );
                return null;
            }
            return this.getUserCanManageUserImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error(
                "failed to get user can manage user image relation",
                { userId, imageOfUserId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateUserCanManageUserImage(
        userCanManageUserImage: UserCanManageUserImage
    ): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceUserCanManageUserImage)
                .update({
                    [ColNameImageServiceUserCanManageUserImageCanEdit]:
                        userCanManageUserImage.canEdit,
                })
                .where({
                    [ColNameImageServiceUserCanManageUserImageUserId]:
                        userCanManageUserImage.userId,
                    [ColNameImageServiceUserCanManageUserImageImageOfUserId]:
                        userCanManageUserImage.imageOfUserId,
                });
        } catch (error) {
            this.logger.error(
                "failed to update user can manage user image relation",
                { userCanManageUserImage, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteUserCanManageUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        try {
            const deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceUserCanManageUserImage)
                .where({
                    [ColNameImageServiceUserCanManageUserImageUserId]: userId,
                    [ColNameImageServiceUserCanManageUserImageImageOfUserId]:
                        imageOfUserId,
                });
            if (deletedCount === 0) {
                this.logger.error(
                    "no user can manage user image relation found",
                    { userId, imageOfUserId }
                );
                throw new ErrorWithStatus(
                    "no user can manage user image relation found",
                    status.NOT_FOUND
                );
            }
        } catch (error) {
            this.logger.error(
                "failed to delete user can manage user image relation",
                { userId, imageOfUserId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (
            dataAccessor: UserCanManageUserImageDataAccessor
        ) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new UserCanManageUserImageDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getUserCanManageUserImageFromRow(
        row: Record<string, any>
    ): UserCanManageUserImage {
        return new UserCanManageUserImage(
            +row[ColNameImageServiceUserCanManageUserImageUserId],
            +row[ColNameImageServiceUserCanManageUserImageImageOfUserId],
            row[ColNameImageServiceUserCanManageUserImageCanEdit]
        );
    }
}

injected(
    UserCanManageUserImageDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN =
    token<UserCanManageUserImageDataAccessor>(
        "UserCanManageUserImageDataAccessor"
    );
