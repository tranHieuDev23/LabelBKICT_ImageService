import { Container } from "brandi";
import {
    ImageManagementOperatorImpl,
    IMAGE_MANAGEMENT_OPERATOR_TOKEN,
} from "./image_management_operator";
import { ImageProcessorImpl, IMAGE_PROCESSOR_TOKEN } from "./image_processor";

export * from "./image_management_operator";

export function bindToContainer(container: Container): void {
    container
        .bind(IMAGE_MANAGEMENT_OPERATOR_TOKEN)
        .toInstance(ImageManagementOperatorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_PROCESSOR_TOKEN)
        .toInstance(ImageProcessorImpl)
        .inSingletonScope();
}
