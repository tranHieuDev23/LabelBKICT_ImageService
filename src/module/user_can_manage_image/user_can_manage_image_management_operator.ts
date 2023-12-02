import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    UserCanManageUserImageDataAccessor,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    UserCanManageImageDataAccessor,
    USER_CAN_MANAGE_IMAGE_DATA_ACCESSOR_TOKEN,
    ImageDataAccessor,
    IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanManageUserImage } from "../../proto/gen/UserCanManageUserImage";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";
import { IMAGE_PERMISSION_CHECKER_TOKEN, ImagePermissionChecker } from "../image";

export interface UserCanManageImageManagementOperator {
    createUserCanManageUserImage(userId: number, imageOfUserId: number, canEdit: boolean): Promise<void>;
    getUserCanManageUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: UserCanManageUserImage[];
    }>;
    updateUserCanManageUserImage(userId: number, imageOfUserId: number, canEdit: boolean | undefined): Promise<void>;
    deleteUserCanManageUserImage(userId: number, imageOfUserId: number): Promise<void>;

    createUserCanManageImage(userId: number, imageId: number, canEdit: boolean): Promise<void>;
    createUserListCanManageImageList(userIdList: number[], imageIdList: number[], canEdit: boolean): Promise<void>;
    getUserCanManageImageListOfImageId(
        imageId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: { userId: number; canEdit: boolean }[];
    }>;
    updateUserCanManageImage(userId: number, imageId: number, canEdit: boolean | undefined): Promise<void>;
    deleteUserCanManageImage(userId: number, imageId: number): Promise<void>;

    checkUserCanManageImageList(
        userId: number,
        imageIdList: number[]
    ): Promise<{ canManageList: boolean[]; canEditList: boolean[] }>;
}

export class UserCanManageImageManagementOperatorImpl implements UserCanManageImageManagementOperator {
    constructor(
        private readonly userCanManageUserImageDM: UserCanManageUserImageDataAccessor,
        private readonly userCanManageImageDM: UserCanManageImageDataAccessor,
        private readonly imageDM: ImageDataAccessor,
        private readonly imagePermissionChecker: ImagePermissionChecker,
        private readonly logger: Logger
    ) {}

    public async createUserCanManageUserImage(userId: number, imageOfUserId: number, canEdit: boolean): Promise<void> {
        if (userId === imageOfUserId) {
            this.logger.error("trying to add user can manage user image relation for the same user", { userId });
            throw new ErrorWithStatus(
                "trying to add user can manage user image relation for the same user",
                status.INVALID_ARGUMENT
            );
        }
        await this.userCanManageUserImageDM.createUserCanManageUserImage(userId, imageOfUserId, canEdit);
    }

    public async getUserCanManageUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanManageUserImage[] }> {
        const dmResults = await Promise.all([
            this.userCanManageUserImageDM.getUserCanManageUserImageCountOfUserId(userId),
            this.userCanManageUserImageDM.getUserCanManageUserImageListOfUserId(userId, offset, limit),
        ]);
        const totalUserCount = dmResults[0];
        const userList = dmResults[1];
        return { totalUserCount, userList };
    }

    public async updateUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean | undefined
    ): Promise<void> {
        await this.userCanManageUserImageDM.withTransaction(async (userCanManageUserImageDM) => {
            const userCanManageUserImage = await userCanManageUserImageDM.getUserCanManageUserImageWithXLock(
                userId,
                imageOfUserId
            );
            if (userCanManageUserImage === null) {
                this.logger.error("no user can manage user image relation between users", { userId, imageOfUserId });
                throw new ErrorWithStatus(
                    "no user can manage user image relation between users",
                    status.FAILED_PRECONDITION
                );
            }
            if (canEdit !== undefined) {
                userCanManageUserImage.canEdit = canEdit;
            }
            await userCanManageUserImageDM.updateUserCanManageUserImage(userCanManageUserImage);
        });
    }

    public async deleteUserCanManageUserImage(userId: number, imageOfUserId: number): Promise<void> {
        await this.userCanManageUserImageDM.deleteUserCanManageUserImage(userId, imageOfUserId);
    }

    public async createUserListCanManageImageList(
        userIdList: number[],
        imageIdList: number[],
        canEdit: boolean
    ): Promise<void> {
        await this.userCanManageImageDM.withTransaction(async (userCanManageImageDM) => {
            for (const imageId of imageIdList) {
                const image = await this.imageDM.getImage(imageId);
                if (image === null) {
                    this.logger.error("cannot find image with the provided id", { imageId });
                    throw new ErrorWithStatus("cannot find image with the provided id", status.NOT_FOUND);
                }

                for (const userId of userIdList) {
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

                    const userCanManageImage = await userCanManageImageDM.getUserCanManageImageWithXLock(
                        userId,
                        imageId
                    );
                    if (userCanManageImage !== null) {
                        this.logger.error("user can manage image relation between user and image already found", {
                            userId,
                            imageId,
                        });
                        throw new ErrorWithStatus(
                            "user can manage image relation between user and image already found",
                            status.FAILED_PRECONDITION
                        );
                    }

                    await userCanManageImageDM.createUserCanManageImage(userId, imageId, canEdit);
                }
            }
        });
    }

    public async createUserCanManageImage(userId: number, imageId: number, canEdit: boolean): Promise<void> {
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

        await this.userCanManageImageDM.withTransaction(async (userCanManageImageDM) => {
            const userCanManageImage = await userCanManageImageDM.getUserCanManageImageWithXLock(userId, imageId);
            if (userCanManageImage !== null) {
                this.logger.error("user can manage image relation between user and image already found", {
                    userId,
                    imageId,
                });
                throw new ErrorWithStatus(
                    "user can manage image relation between user and image already found",
                    status.FAILED_PRECONDITION
                );
            }

            await userCanManageImageDM.createUserCanManageImage(userId, imageId, canEdit);
        });
    }

    public async getUserCanManageImageListOfImageId(
        imageId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: { userId: number; canEdit: boolean }[];
    }> {
        const [totalUserCount, userCanManageImageList] = await Promise.all([
            this.userCanManageImageDM.getUserCanManageImageCountOfImageId(imageId),
            this.userCanManageImageDM.getUserCanManageImageListOfImageId(imageId, offset, limit),
        ]);
        return {
            totalUserCount: totalUserCount,
            userList: userCanManageImageList.map((item) => {
                return { userId: item.userId, canEdit: item.canEdit };
            }),
        };
    }

    public async updateUserCanManageImage(
        userId: number,
        imageId: number,
        canEdit: boolean | undefined
    ): Promise<void> {
        await this.userCanManageImageDM.withTransaction(async (userCanManageImageDM) => {
            const userCanManageImage = await userCanManageImageDM.getUserCanManageImageWithXLock(userId, imageId);
            if (userCanManageImage === null) {
                this.logger.error("no user can manage image relation between user and image", { userId, imageId });
                throw new ErrorWithStatus(
                    "no user can manage image relation between user and image",
                    status.FAILED_PRECONDITION
                );
            }

            if (canEdit !== undefined) {
                userCanManageImage.canEdit = canEdit;
            }

            await userCanManageImageDM.updateUserCanManageImage(userCanManageImage);
        });
    }

    public async deleteUserCanManageImage(userId: number, imageId: number): Promise<void> {
        await this.userCanManageImageDM.deleteUserCanManageImage(userId, imageId);
    }

    public async checkUserCanManageImageList(
        userId: number,
        imageIdList: number[]
    ): Promise<{ canManageList: boolean[]; canEditList: boolean[] }> {
        return this.imagePermissionChecker.canUserManageImageList(userId, imageIdList);
    }
}

injected(
    UserCanManageImageManagementOperatorImpl,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_MANAGE_IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_PERMISSION_CHECKER_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_MANAGE_IMAGE_MANAGEMENT_OPERATOR = token<UserCanManageImageManagementOperator>(
    "UserCanManageImageManagementOperator"
);
