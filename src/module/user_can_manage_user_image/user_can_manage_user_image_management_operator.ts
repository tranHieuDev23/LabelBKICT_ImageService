import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    UserCanManageUserImageDataAccessor,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanManageUserImage } from "../../proto/gen/UserCanManageUserImage";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";

export interface UserCanManageUserImageManagementOperator {
    createUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean
    ): Promise<void>;
    getUserCanManageUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: UserCanManageUserImage[];
    }>;
    updateUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean | undefined
    ): Promise<void>;
    deleteUserCanManageUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
}

export class UserCanManageUserImageManagementOperatorImpl
    implements UserCanManageUserImageManagementOperator
{
    constructor(
        private readonly userCanManageUserImageDM: UserCanManageUserImageDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean
    ): Promise<void> {
        if (userId === imageOfUserId) {
            this.logger.error(
                "trying to add user can manage user image relation for the same user",
                { userId }
            );
            throw new ErrorWithStatus(
                "trying to add user can manage user image relation for the same user",
                status.INVALID_ARGUMENT
            );
        }
        await this.userCanManageUserImageDM.createUserCanManageUserImage(
            userId,
            imageOfUserId,
            canEdit
        );
    }

    public async getUserCanManageUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanManageUserImage[] }> {
        const dmResults = await Promise.all([
            this.userCanManageUserImageDM.getUserCanManageUserImageCountOfUserId(
                userId
            ),
            this.userCanManageUserImageDM.getUserCanManageUserImageListOfUserId(
                userId,
                offset,
                limit
            ),
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
        await this.userCanManageUserImageDM.withTransaction(
            async (userCanManageUserImageDM) => {
                const userCanManageUserImage =
                    await userCanManageUserImageDM.getUserCanManageUserImageWithXLock(
                        userId,
                        imageOfUserId
                    );
                if (userCanManageUserImage === null) {
                    this.logger.error(
                        "no user can manage user image relation between users",
                        { userId, imageOfUserId }
                    );
                    throw new ErrorWithStatus(
                        "no user can manage user image relation between users",
                        status.FAILED_PRECONDITION
                    );
                }
                if (canEdit !== undefined) {
                    userCanManageUserImage.canEdit = canEdit;
                }
                await userCanManageUserImageDM.updateUserCanManageUserImage(
                    userCanManageUserImage
                );
            }
        );
    }

    public async deleteUserCanManageUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        await this.userCanManageUserImageDM.deleteUserCanManageUserImage(
            userId,
            imageOfUserId
        );
    }
}

injected(
    UserCanManageUserImageManagementOperatorImpl,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_MANAGE_USER_IMAGE_MANAGEMENT_OPERATOR =
    token<UserCanManageUserImageManagementOperator>(
        "UserCanManageUserImageManagementOperator"
    );
