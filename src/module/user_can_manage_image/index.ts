import { Container } from "brandi";
import {
    UserCanManageImageManagementOperatorImpl,
    USER_CAN_MANAGE_IMAGE_MANAGEMENT_OPERATOR,
} from "./user_can_manage_image_management_operator";

export * from "./user_can_manage_image_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(USER_CAN_MANAGE_IMAGE_MANAGEMENT_OPERATOR)
        .toInstance(UserCanManageImageManagementOperatorImpl)
        .inSingletonScope();
}
