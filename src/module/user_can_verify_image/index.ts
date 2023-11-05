import { Container } from "brandi";
import {
    UserCanVerifyUserImageManagementOperatorImpl,
    USER_CAN_VERIFY_USER_IMAGE_MANAGEMENT_OPERATOR,
} from "./user_can_verify_image_management_operator";

export * from "./user_can_verify_image_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(USER_CAN_VERIFY_USER_IMAGE_MANAGEMENT_OPERATOR)
        .toInstance(UserCanVerifyUserImageManagementOperatorImpl)
        .inSingletonScope();
}
