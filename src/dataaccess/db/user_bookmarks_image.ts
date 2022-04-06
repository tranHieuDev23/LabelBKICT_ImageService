import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Knex } from "knex";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { KNEX_INSTANCE_TOKEN } from "./knex";

export class UserBookmarksImage {
    constructor(
        public userId: number,
        public imageId: number,
        public description: string
    ) {}
}

export interface UserBookmarksImageDataAccessor {
    createUserBookmarksImage(
        userId: number,
        imageId: number,
        description: string
    ): Promise<void>;
    getBookmarkedImageListOfUserId(
        userId: number
    ): Promise<UserBookmarksImage[]>;
    getUserBookmarksImage(
        userId: number,
        imageId: number
    ): Promise<UserBookmarksImage | null>;
    getUserBookmarksImageWithXLock(
        userId: number,
        imageId: number
    ): Promise<UserBookmarksImage | null>;
    updateUserBookmarksImage(bookmark: UserBookmarksImage): Promise<void>;
    deleteUserBookmarksImage(userId: number, imageId: number): Promise<void>;
}

const TabNameImageServiceUserBookmarksImage =
    "image_service_user_bookmarks_image";
const ColNameImageServiceUserBookmarksImageUserId = "user_id";
const ColNameImageServiceUserBookmarksImageImageId = "image_id";
const ColNameImageServiceUserBookmarksImageDescription = "description";

export class UserBookmarksImageDataAccessorImpl
    implements UserBookmarksImageDataAccessor
{
    constructor(
        private readonly knex: Knex<any, any[]>,
        private readonly logger: Logger
    ) {}

    public async createUserBookmarksImage(
        userId: number,
        imageId: number,
        description: string
    ): Promise<void> {
        try {
            await this.knex
                .insert({
                    [ColNameImageServiceUserBookmarksImageUserId]: userId,
                    [ColNameImageServiceUserBookmarksImageImageId]: imageId,
                    [ColNameImageServiceUserBookmarksImageDescription]:
                        description,
                })
                .into(TabNameImageServiceUserBookmarksImage);
        } catch (error) {
            this.logger.error(
                "failed to create user bookmarks image relation",
                { userId, imageId, description, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getBookmarkedImageListOfUserId(
        userId: number
    ): Promise<UserBookmarksImage[]> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserBookmarksImage)
                .where({
                    [ColNameImageServiceUserBookmarksImageUserId]: userId,
                });
            return rows.map((row) => this.getUserBookmarksImageFromRow(row));
        } catch (error) {
            this.logger.error(
                "failed to get user bookmarks image relation list",
                { userId, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserBookmarksImage(
        userId: number,
        imageId: number
    ): Promise<UserBookmarksImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserBookmarksImage)
                .where({
                    [ColNameImageServiceUserBookmarksImageUserId]: userId,
                    [ColNameImageServiceUserBookmarksImageImageId]: imageId,
                });
            if (rows.length === 0) {
                this.logger.info("no user bookmarks image relation found", {
                    userId,
                    imageId,
                });
                return null;
            }
            return this.getUserBookmarksImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user bookmarks image relation", {
                userId,
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async getUserBookmarksImageWithXLock(
        userId: number,
        imageId: number
    ): Promise<UserBookmarksImage | null> {
        try {
            const rows = await this.knex
                .select()
                .from(TabNameImageServiceUserBookmarksImage)
                .where({
                    [ColNameImageServiceUserBookmarksImageUserId]: userId,
                    [ColNameImageServiceUserBookmarksImageImageId]: imageId,
                })
                .forUpdate();
            if (rows.length === 0) {
                this.logger.info("no user bookmarks image relation found", {
                    userId,
                    imageId,
                });
                return null;
            }
            return this.getUserBookmarksImageFromRow(rows[0]);
        } catch (error) {
            this.logger.error("failed to get user bookmarks image relation", {
                userId,
                imageId,
                error,
            });
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async updateUserBookmarksImage(
        bookmark: UserBookmarksImage
    ): Promise<void> {
        try {
            await this.knex
                .table(TabNameImageServiceUserBookmarksImage)
                .update({
                    [ColNameImageServiceUserBookmarksImageDescription]:
                        bookmark.description,
                })
                .where({
                    [ColNameImageServiceUserBookmarksImageUserId]:
                        bookmark.userId,
                    [ColNameImageServiceUserBookmarksImageImageId]:
                        bookmark.imageId,
                });
        } catch (error) {
            this.logger.error(
                "failed to update user bookmarks image relation",
                { bookmark, error }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    public async deleteUserBookmarksImage(
        userId: number,
        imageId: number
    ): Promise<void> {
        try {
            const deleteCount = await this.knex
                .delete()
                .from(TabNameImageServiceUserBookmarksImage)
                .where({
                    [ColNameImageServiceUserBookmarksImageUserId]: userId,
                    [ColNameImageServiceUserBookmarksImageImageId]: imageId,
                });
            if (deleteCount === 0) {
                this.logger.info("no user bookmarks image relation found", {
                    userId,
                    imageId,
                });
                throw new ErrorWithStatus(
                    "no user bookmarks image relation found",
                    status.NOT_FOUND
                );
            }
        } catch (error) {
            this.logger.error(
                "failed to delete user bookmarks image relation",
                {
                    userId,
                    imageId,
                    error,
                }
            );
            throw ErrorWithStatus.wrapWithStatus(error, status.INTERNAL);
        }
    }

    private getUserBookmarksImageFromRow(
        row: Record<string, any>
    ): UserBookmarksImage {
        return new UserBookmarksImage(
            +row[ColNameImageServiceUserBookmarksImageUserId],
            +row[ColNameImageServiceUserBookmarksImageImageId],
            row[ColNameImageServiceUserBookmarksImageDescription]
        );
    }
}

injected(UserBookmarksImageDataAccessorImpl, KNEX_INSTANCE_TOKEN, LOGGER_TOKEN);

export const USER_BOOKMARKS_IMAGE_DATA_ACCESSOR_TOKEN =
    token<UserBookmarksImageDataAccessor>("UserBookmarksImageDataAccessor");
