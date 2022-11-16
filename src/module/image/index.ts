import { Container } from "brandi";
import {
    AddImageTagToImageOperatorImpl,
    ADD_IMAGE_TAG_TO_IMAGE_OPERATOR_TOKEN,
} from "./add_image_tag_to_image_operator";
import {
    IMAGE_LIST_MANAGEMENT_OPERATOR_TOKEN,
    ImageListManagementOperatorImpl,
} from "./image_list_management_operator";
import { ImageManagementOperatorImpl, IMAGE_MANAGEMENT_OPERATOR_TOKEN } from "./image_management_operator";
import { ImageProcessorImpl, IMAGE_PROCESSOR_TOKEN } from "./image_processor";

export * from "./image_management_operator";
export * from "./image_list_management_operator";

export function bindToContainer(container: Container): void {
    container.bind(IMAGE_MANAGEMENT_OPERATOR_TOKEN).toInstance(ImageManagementOperatorImpl).inSingletonScope();
    container.bind(IMAGE_LIST_MANAGEMENT_OPERATOR_TOKEN).toInstance(ImageListManagementOperatorImpl).inSingletonScope();
    container.bind(IMAGE_PROCESSOR_TOKEN).toInstance(ImageProcessorImpl).inSingletonScope();
    container.bind(ADD_IMAGE_TAG_TO_IMAGE_OPERATOR_TOKEN).toInstance(AddImageTagToImageOperatorImpl).inSingletonScope();
}
