import { Container } from "brandi";
import {
    UserCanManageUserImageManagementOperatorImpl,
    USER_CAN_MANAGE_USER_IMAGE_MANAGEMENT_OPERATOR,
} from "./user_can_manage_user_image_management_operator";

export * from "./user_can_manage_user_image_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(USER_CAN_MANAGE_USER_IMAGE_MANAGEMENT_OPERATOR)
        .toInstance(UserCanManageUserImageManagementOperatorImpl)
        .inSingletonScope();
}
