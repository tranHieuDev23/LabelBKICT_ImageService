import { status } from "@grpc/grpc-js";
import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    UserCanVerifyUserImageDataAccessor,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanVerifyUserImage } from "../../proto/gen/UserCanVerifyUserImage";
import { ErrorWithStatus, LOGGER_TOKEN } from "../../utils";

export interface UserCanVerifyUserImageManagementOperator {
    createUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
    getUserCanVerifyUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{
        totalUserCount: number;
        userList: UserCanVerifyUserImage[];
    }>;
    deleteUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void>;
}

export class UserCanVerifyUserImageManagementOperatorImpl
    implements UserCanVerifyUserImageManagementOperator
{
    constructor(
        private readonly userCanVerifyUserImageDM: UserCanVerifyUserImageDataAccessor,
        private readonly logger: Logger
    ) {}

    public async createUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        if (userId === imageOfUserId) {
            this.logger.error(
                "trying to add user can verify user image relation for the same user",
                { userId }
            );
            throw new ErrorWithStatus(
                "trying to add user can verify user image relation for the same user",
                status.INVALID_ARGUMENT
            );
        }
        await this.userCanVerifyUserImageDM.createUserCanVerifyUserImage(
            userId,
            imageOfUserId
        );
    }

    public async getUserCanVerifyUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanVerifyUserImage[] }> {
        const dmResults = await Promise.all([
            this.userCanVerifyUserImageDM.getUserCanVerifyUserImageCountOfUserId(
                userId
            ),
            this.userCanVerifyUserImageDM.getUserCanVerifyUserImageListOfUserId(
                userId,
                offset,
                limit
            ),
        ]);
        const totalUserCount = dmResults[0];
        const userList = dmResults[1];
        return { totalUserCount, userList };
    }

    public async deleteUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        await this.userCanVerifyUserImageDM.deleteUserCanVerifyUserImage(
            userId,
            imageOfUserId
        );
    }
}

injected(
    UserCanVerifyUserImageManagementOperatorImpl,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    LOGGER_TOKEN
);

export const USER_CAN_VERIFY_USER_IMAGE_MANAGEMENT_OPERATOR =
    token<UserCanVerifyUserImageManagementOperator>(
        "UserCanVerifyUserImageVerifyManagementOperator"
    );
