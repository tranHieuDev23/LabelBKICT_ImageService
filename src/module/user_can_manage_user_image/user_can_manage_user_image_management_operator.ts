import { injected, token } from "brandi";
import { Logger } from "winston";
import {
    UserCanManageUserImageDataAccessor,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
} from "../../dataaccess/db";
import { UserCanManageUserImage } from "../../proto/gen/UserCanManageUserImage";
import { LOGGER_TOKEN } from "../../utils";

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
        canEdit: boolean
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
        throw new Error("Method not implemented.");
    }

    public async getUserCanManageUserImageOfUserId(
        userId: number,
        offset: number,
        limit: number
    ): Promise<{ totalUserCount: number; userList: UserCanManageUserImage[] }> {
        throw new Error("Method not implemented.");
    }

    public async updateUserCanManageUserImage(
        userId: number,
        imageOfUserId: number,
        canEdit: boolean
    ): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async deleteUserCanManageUserImage(
        userId: number,
        imageOfUserId: number
    ): Promise<void> {
        throw new Error("Method not implemented.");
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
