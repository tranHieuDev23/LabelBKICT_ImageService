import { Container } from "brandi";
import {
    ImageTagManagementOperatorImpl,
    IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN,
} from "./image_tag_management_operator";

export * from "./image_tag_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(IMAGE_TAG_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(ImageTagManagementOperatorImpl)
        .inSingletonScope();
}
