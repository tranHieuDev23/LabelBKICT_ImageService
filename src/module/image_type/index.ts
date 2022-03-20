import { Container } from "brandi";
import {
    ImageTypeManagementOperatorImpl,
    IMAGE_TYPE_MANAGEMENT_OPERATOR_TOKEN,
} from "./image_type_management_operator";

export * from "./image_type_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(IMAGE_TYPE_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(ImageTypeManagementOperatorImpl)
        .inSingletonScope();
}
