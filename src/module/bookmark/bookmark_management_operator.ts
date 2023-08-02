import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import validator from "validator";
import { filterXSS } from "xss";
import { Logger } from "winston";
import {
    ImageDataAccessor,
    IMAGE_DATA_ACCESSOR_TOKEN,
    UserBookmarksImageDataAccessor,
    USER_BOOKMARKS_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { ImageBookmark } from "../../proto/gen/ImageBookmark";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";

export interface BookmarkManagementOperator {
    createImageBookmark(userId: number, imageId: number, description: string): Promise<ImageBookmark>;
    getImageBookmark(userId: number, imageId: number): Promise<ImageBookmark>;
    updateImageBookmark(userId: number, imageId: number, description: string | undefined): Promise<ImageBookmark>;
    deleteImageBookmark(userId: number, imageId: number): Promise<void>;
}

export class BookmarkManagementOperatorImpl implements BookmarkManagementOperator {
    constructor(
        private readonly imageDM: ImageDataAccessor,
        private readonly userBookmarksImageDM: UserBookmarksImageDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createImageBookmark(userId: number, imageId: number, description: string): Promise<ImageBookmark> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("no image with image_id found", { imageId });
            throw new ErrorWithStatus(`no image with image_id ${imageId} found`, status.NOT_FOUND);
        }
        description = this.sanitizeDescription(description);
        return await this.userBookmarksImageDM.withTransaction(async (userBookmarksImageDM) => {
            const bookmark = await userBookmarksImageDM.getUserBookmarksImageWithXLock(userId, imageId);
            if (bookmark !== null) {
                this.logger.error("user has already bookmarked image", {
                    userId,
                    imageId,
                });
                throw new ErrorWithStatus(
                    `user ${userId} has already bookmarked image ${imageId}`,
                    status.ALREADY_EXISTS
                );
            }
            await userBookmarksImageDM.createUserBookmarksImage(userId, imageId, description);
            return { description };
        });
    }

    public async getImageBookmark(userId: number, imageId: number): Promise<ImageBookmark> {
        const bookmark = await this.userBookmarksImageDM.getUserBookmarksImageWithXLock(userId, imageId);
        if (bookmark === null) {
            this.logger.error("user has not bookmarked image", {
                userId,
                imageId,
            });
            throw new ErrorWithStatus(`user ${userId} has not bookmarked image ${imageId}`, status.NOT_FOUND);
        }
        return bookmark;
    }

    public async updateImageBookmark(
        userId: number,
        imageId: number,
        description: string | undefined
    ): Promise<ImageBookmark> {
        if (description !== undefined) {
            description = this.sanitizeDescription(description);
        }
        return await this.userBookmarksImageDM.withTransaction(async (userBookmarksImageDM) => {
            const bookmark = await userBookmarksImageDM.getUserBookmarksImageWithXLock(userId, imageId);
            if (bookmark === null) {
                this.logger.error("user has not bookmarked image", {
                    userId,
                    imageId,
                });
                throw new ErrorWithStatus(`user ${userId} has not bookmarked image ${imageId}`, status.NOT_FOUND);
            }
            if (description !== undefined) {
                bookmark.description = description;
            }
            await userBookmarksImageDM.updateUserBookmarksImage(bookmark);
            return bookmark;
        });
    }

    public async deleteImageBookmark(userId: number, imageId: number): Promise<void> {
        return await this.userBookmarksImageDM.deleteUserBookmarksImage(userId, imageId);
    }

    private sanitizeDescription(description: string): string {
        return filterXSS(validator.trim(description));
    }
}

injected(
    BookmarkManagementOperatorImpl,
    IMAGE_DATA_ACCESSOR_TOKEN,
    USER_BOOKMARKS_IMAGE_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const BOOKMARK_MANAGEMENT_OPERATOR_TOKEN = token<BookmarkManagementOperator>("BookmarkManagementOperator");
