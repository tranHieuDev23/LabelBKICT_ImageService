import {
    IMAGE_DATA_ACCESSOR_TOKEN,
    ImageDataAccessor,
    USER_CAN_MANAGE_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_VERIFY_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    UserCanManageImageDataAccessor,
    UserCanManageUserImageDataAccessor,
    UserCanVerifyImageDataAccessor,
    UserCanVerifyUserImageDataAccessor,
} from "../../dataaccess/db";
import { injected, token } from "brandi";
import { ErrorWithStatus } from "../../utils";
import { status } from "@grpc/grpc-js";
import { _ImageStatus_Values } from "../../proto/gen/ImageStatus";

export interface ImagePermissionChecker {
    canUserManageImageList(
        userId: number,
        imageIdList: number[]
    ): Promise<{ canManageList: boolean[]; canEditList: boolean[] }>;
    canUserManageAllImage(userId: number): Promise<boolean>;
    canUserVerifyImageList(userId: number, imageIdList: number[]): Promise<boolean[]>;
    canUserVerifyAllImage(userId: number): Promise<boolean>;
}

export class ImagePermissionCheckerImpl implements ImagePermissionChecker {
    constructor(
        private readonly userCanManageUserImageDM: UserCanManageUserImageDataAccessor,
        private readonly userCanManageImageDM: UserCanManageImageDataAccessor,
        private readonly userCanVerifyUserImageDM: UserCanVerifyUserImageDataAccessor,
        private readonly userCanVerifyImageDM: UserCanVerifyImageDataAccessor,
        private readonly imageDM: ImageDataAccessor
    ) {}

    public async canUserManageImageList(
        userId: number,
        imageIdList: number[]
    ): Promise<{ canManageList: boolean[]; canEditList: boolean[] }> {
        if (await this.canUserManageAllImage(userId)) {
            return {
                canManageList: new Array(imageIdList.length).fill(true),
                canEditList: new Array(imageIdList.length).fill(true),
            };
        }

        const canManageList = new Array<boolean>(imageIdList.length);
        const canEditList = new Array<boolean>(imageIdList.length);

        await Promise.all(
            imageIdList.map(async (imageId, index) => {
                const { canManage, canEdit } = await this.canUserManageImage(userId, imageId);
                canManageList[index] = canManage;
                canEditList[index] = canEdit;
            })
        );

        return { canManageList, canEditList };
    }

    private async canUserManageImage(
        userId: number,
        imageId: number
    ): Promise<{ canManage: boolean; canEdit: boolean }> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            throw new ErrorWithStatus("cannot find image with the provided id", status.NOT_FOUND);
        }

        if (userId === image.uploadedByUserId) {
            return { canManage: true, canEdit: true };
        }

        const [userCanManageUserImage, userCanManageImage] = await Promise.all([
            this.userCanManageUserImageDM.getUserCanManageUserImage(userId, image.uploadedByUserId),
            this.userCanManageImageDM.getUserCanManageImage(userId, imageId),
        ]);
        if (userCanManageUserImage !== null || userCanManageImage !== null) {
            const canEdit = userCanManageUserImage?.canEdit || userCanManageImage?.canEdit || false;
            return { canManage: true, canEdit: canEdit };
        }

        return { canManage: false, canEdit: false };
    }

    public async canUserManageAllImage(userId: number): Promise<boolean> {
        const [userCanManageUserImageCount, userCanManageImageCount] = await Promise.all([
            this.userCanManageUserImageDM.getUserCanManageUserImageCountOfUserId(userId),
            this.userCanManageImageDM.getUserCanManageImageCountOfUserId(userId),
        ]);
        return userCanManageImageCount === 0 && userCanManageUserImageCount === 0;
    }

    public async canUserVerifyImageList(userId: number, imageIdList: number[]): Promise<boolean[]> {
        if (await this.canUserVerifyAllImage(userId)) {
            return new Array(imageIdList.length).fill(true);
        }

        return await Promise.all(imageIdList.map((imageId) => this.canUserVerifyImage(userId, imageId)));
    }

    private async canUserVerifyImage(userId: number, imageId: number): Promise<boolean> {
        const image = await this.imageDM.getImage(imageId);
        if (image === null) {
            throw new ErrorWithStatus("cannot find image with the provided id", status.NOT_FOUND);
        }

        if (image.status !== _ImageStatus_Values.PUBLISHED && image.status !== _ImageStatus_Values.VERIFIED) {
            return false;
        }

        if (!(await this.userCanVerifyUserImageDM.getUserCanVerifyUserImage(userId, image.uploadedByUserId))) {
            return true;
        }

        if (!(await this.userCanVerifyImageDM.getUserCanVerifyImage(userId, imageId))) {
            return true;
        }

        return false;
    }

    public async canUserVerifyAllImage(userId: number): Promise<boolean> {
        const [userCanVerifyUserImageCount, userCanVerifyImageCount] = await Promise.all([
            this.userCanVerifyUserImageDM.getUserCanVerifyUserImageCountOfUserId(userId),
            this.userCanVerifyImageDM.getUserCanVerifyImageCountOfUserId(userId),
        ]);
        return userCanVerifyImageCount === 0 && userCanVerifyUserImageCount === 0;
    }
}

injected(
    ImagePermissionCheckerImpl,
    USER_CAN_MANAGE_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_MANAGE_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_VERIFY_USER_IMAGE_DATA_ACCESSOR_TOKEN,
    USER_CAN_VERIFY_IMAGE_DATA_ACCESSOR_TOKEN,
    IMAGE_DATA_ACCESSOR_TOKEN
);

export const IMAGE_PERMISSION_CHECKER_TOKEN = token<ImagePermissionChecker>("ImagePermissionChecker");
