import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    UserCanVerifyUserImageDataAccessor,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanVerifyUserImage } from "../../proto/gen/UserCanVerifyUserImage";
import { LOGGER_TOKEN } from "../../utils";

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
        throw new Error("Method not implemented.");
    }

    public async getUserCanVerifyUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanVerifyUserImage[] }> {
        throw new Error("Method not implemented.");
    }

    public async deleteUserCanVerifyUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
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
