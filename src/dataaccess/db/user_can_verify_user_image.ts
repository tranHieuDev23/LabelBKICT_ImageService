import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class UserCanVerifyUserImage {
    constructor(public userId: number, public imageOfUserId: number) {}
}

export interface UserCanVerifyUserImageDataAccessor {
    createUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
    getUserCanVerifyUserImageCountOfUserId(userId: number): Promise<number>;
    getUserCanVerifyUserImageListOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<UserCanVerifyUserImage[]>;
    getUserCanVerifyUserImageWithXLock(
        userId: number,
        imageOfUserId: number
    ): Promise<UserCanVerifyUserImage | null>;
    deleteUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
    withTransaction<T>(
        executeFunc: (
            dataAccessor: UserCanVerifyUserImageDataAccessor
        ) => Promise<T>
    ): Promise<T>;
}

const TabNameImageServiceUserCanVerifyUserImage =
    "image_service_user_can_verify_user_image";
const ColNameImageServiceUserCanVerifyUserImageUserId = "user_id";
const ColNameImageServiceUserCanVerifyUserImageImageOfUserId =
    "image_of_user_id";

export class UserCanVerifyUserImageDataAccessorImpl
    implements UserCanVerifyUserImageDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceUserCanVerifyUserImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyUserImageImageOfUserId]:
                        imageOfUserId,
                })
                .into(TabNameImageServiceUserCanVerifyUserImage);
        } catch (error) {
            this.logger.error(
                "failed to create user can verify user image relation",
                { userId, imageOfUserId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyUserImageCountOfUserId(
        userId: number
    ): Promise<number> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanVerifyUserImage)
                .where({
                    [ColNameImageServiceUserCanVerifyUserImageUserId]: userId,
                });
            return +rows[0];
        } catch (error) {
            this.logger.error(
                "failed to get user can verify user image relation count",
                { userId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyUserImageListOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<UserCanVerifyUserImage[]> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanVerifyUserImage)
                .where({
                    [ColNameImageServiceUserCanVerifyUserImageUserId]: userId,
                })
                .offset(offset)
                .limit(limit);
            return rows.map((row) =>
                this.getUserCanVerifyUserImageFromRow(row)
            );
        } catch (error) {
            this.logger.error(
                "failed to get user can verify user image relation list",
                { userId, offset, limit, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserCanVerifyUserImageWithXLock(
        userId: number,
        imageOfUserId: number
    ): Promise<UserCanVerifyUserImage | null> {
        try {
            const rows = await this.knex
                .count()
                .from(TabNameImageServiceUserCanVerifyUserImage)
                .where({
                    [ColNameImageServiceUserCanVerifyUserImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyUserImageImageOfUserId]:
                        imageOfUserId,
                });
            if (rows.length === 0) {
                this.logger.error(
                    "no user can verify user image relation found",
                    { userId, imageOfUserId }
                );
                return null;
            }
            return this.getUserCanVerifyUserImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error(
                "failed to get user can verify user image relation",
                { userId, imageOfUserId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        try {
            const deletedCount = await this.knex
                .delete()
                .from(TabNameImageServiceUserCanVerifyUserImage)
                .where({
                    [ColNameImageServiceUserCanVerifyUserImageUserId]: userId,
                    [ColNameImageServiceUserCanVerifyUserImageImageOfUserId]:
                        imageOfUserId,
                });
            if (deletedCount === 0) {
                this.logger.error(
                    "no user can verify user image relation found",
                    { userId, imageOfUserId }
                );
                throw new ErrorWithStatus(
                    "no user can verify user image relation found",
                    status.NOT_FOUND
                );
            }
        } catch (error) {
            this.logger.error(
                "failed to delete user can verify user image relation",
                { userId, imageOfUserId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async withTransaction<T>(
        executeFunc: (
            dataAccessor: UserCanVerifyUserImageDataAccessor
        ) => Promise<T>
    ): Promise<T> {
        return this.knex.transaction(async (tx) => {
            const txDataAccessor = new UserCanVerifyUserImageDataAccessorImpl(
                tx,
                this.logger
            );
            return executeFunc(txDataAccessor);
        });
    }

    private getUserCanVerifyUserImageFromRow(
        row: Record<string, any>
    ): UserCanVerifyUserImage {
        return new UserCanVerifyUserImage(
            +row[ColNameImageServiceUserCanVerifyUserImageUserId],
            +row[ColNameImageServiceUserCanVerifyUserImageImageOfUserId]
        );
    }
}

injected(
    UserCanVerifyUserImageDataAccessorImpl,
    KNEX_INSTANCE_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN =
    token<UserCanVerifyUserImageDataAccessor>(
        "UserCanVerifyUserImageDataAccessor"
    );
