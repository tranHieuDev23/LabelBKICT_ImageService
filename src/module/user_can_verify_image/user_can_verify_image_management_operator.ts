import { injected, token } from "brandi";
import {
    UserCanVerifyUserImageDataAccessor,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    UserCanVerifyImageDataAccessor,
    ImageDataAccessor,
    USER_CAN_VERIFY_IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanVerifyUserImage } from "../../proto/gen/UserCanVerifyUserImage";
import { Logger } from "winston";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { status } from "@grpc/grpc-js";
import { IMAGE_PERMISSION_CHECKER_TOKEN, ImagePermissionChecker } from "../image";

export interface UserCanVerifyUserImageManagementOperator {
    createUserCanVerifyUserImage(userId: number, imageOfUserId: number): Promise<void>;
    getUserCanVerifyUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: UserCanVerifyUserImage[];
    }>;
    deleteUserCanVerifyUserImage(userId: number, imageOfUserId: number): Promise<void>;

    createUserCanVerifyImage(userId: number, imageId: number): Promise<void>;
    getUserCanVerifyImageListOfImageId(
        imageId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: { userId: number }[];
    }>;
    deleteUserCanVerifyImage(userId: number, imageId: number): Promise<void>;

    checkUserCanVerifyImageList(userId: number, imageIdList: number[]): Promise<boolean[]>;
}

export class UserCanVerifyUserImageManagementOperatorImpl implements UserCanVerifyUserImageManagementOperator {
    constructor(
        private readonly userCanVerifyUserImageDM: UserCanVerifyUserImageDataAccessor,
        private readonly userCanVerifyImageDM: UserCanVerifyImageDataAccessor,
        private readonly imageDM: ImageDataAccessor,
        private readonly imagePermissionChecker: ImagePermissionChecker,
        private readonly logger: Logger
    ) {}

    public async createUserCanVerifyUserImage(userId: number, imageOfUserId: number): Promise<void> {
        await this.userCanVerifyUserImageDM.createUserCanVerifyUserImage(userId, imageOfUserId);
    }

    public async getUserCanVerifyUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanVerifyUserImage[] }> {
        const dmResults = await Promise.all([
            this.userCanVerifyUserImageDM.getUserCanVerifyUserImageCountOfUserId(userId),
            this.userCanVerifyUserImageDM.getUserCanVerifyUserImageListOfUserId(userId, offset, limit),
        ]);
        const totalUserCount = dmResults[0];
        const userList = dmResults[1];
        return { totalUserCount, userList };
    }

    public async deleteUserCanVerifyUserImage(userId: number, imageOfUserId: number): Promise<void> {
        await this.userCanVerifyUserImageDM.deleteUserCanVerifyUserImage(userId, imageOfUserId);
    }

    public async createUserCanVerifyImage(userId: number, imageId: number): Promise<void> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            this.logger.error("cannot find image with the provided id", { imageId });
            throw new ErrorWithStatus("cannot find image with the provided id", status.NOT_FOUND);
        }

        if (image.uploadedByUserId === userId) {
            this.logger.error(
                "trying to create user can manage image relation between an image and its uploader, not necessary",
                { userId, imageId }
            );
            throw new ErrorWithStatus(
                "trying to create user can manage image relation between an image and its uploader, not necessary",
                status.FAILED_PRECONDITION
            );
        }

        await this.userCanVerifyImageDM.withTransaction(async (userCanVerifyImageDM) => {
            const userCanManageImage = await userCanVerifyImageDM.getUserCanVerifyImageWithXLock(userId, imageId);
            if (userCanManageImage !== null) {
                this.logger.error("user can verify image relation between user and image already found", {
                    userId,
                    imageId,
                });
                throw new ErrorWithStatus(
                    "user can verify image relation between user and image already found",
                    status.FAILED_PRECONDITION
                );
            }

            await userCanVerifyImageDM.createUserCanVerifyImage(userId, imageId);
        });
    }

    public async getUserCanVerifyImageListOfImageId(
        imageId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: { userId: number }[];
    }> {
        const [totalUserCount, userCanVerifyImageList] = await Promise.all([
            this.userCanVerifyImageDM.getUserCanVerifyImageCountOfImageId(imageId),
            this.userCanVerifyImageDM.getUserCanVerifyImageListOfImageId(imageId, offset, limit),
        ]);
        return {
            totalUserCount: totalUserCount,
            userList: userCanVerifyImageList.map((item) => {
                return { userId: item.userId };
            }),
        };
    }

    public async deleteUserCanVerifyImage(userId: number, imageId: number): Promise<void> {
        await this.userCanVerifyImageDM.deleteUserCanVerifyImage(userId, imageId);
    }

    public async checkUserCanVerifyImageList(userId: number, imageIdList: number[]): Promise<boolean[]> {
        return this.imagePermissionChecker.canUserVerifyImageList(userId, imageIdList);
    }
}

injected(
    UserCanVerifyUserImageManagementOperatorImpl,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_VERIFY_IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_PERMISSION_CHECKER_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_VERIFY_USER_IMAGE_MANAGEMENT_OPERATOR = token<UserCanVerifyUserImageManagementOperator>(
    "UserCanVerifyUserImageVerifyManagementOperator"
);
