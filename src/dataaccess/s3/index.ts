import { Container } from "brandi";
import { MINIO_CLIENT_TOKEN, newMinioClient } from "./minio";
import { initializeOriginalImageDM, ORIGINAL_IMAGE_DM_TOKEN } from "./original_image";
import { initializeThumbnailImageDM, THUMBNAIL_IMAGE_DM_TOKEN } from "./thumbnail_image";

export * from "./bucket_dm";
export * from "./original_image";
export * from "./thumbnail_image";

export function bindToContainer(container: Container): void {
    container.bind(MINIO_CLIENT_TOKEN).toInstance(newMinioClient).inSingletonScope();
    container.bind(ORIGINAL_IMAGE_DM_TOKEN).toInstance(initializeOriginalImageDM).inSingletonScope();
    container.bind(THUMBNAIL_IMAGE_DM_TOKEN).toInstance(initializeThumbnailImageDM).inSingletonScope();
}
