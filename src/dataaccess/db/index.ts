import { Container } from "brandi";
import { ImageDataAccessorImpl, IMAGE_DATA_ACCESSOR_TOKEN } from "./image";
import {
    ImageHasImageTagDataAccessorImpl,
    IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN,
} from "./image_has_image_tag";
import {
    ImageTagDataAccessorImpl,
    IMAGE_TAG_DATA_ACCESSOR_TOKEN,
} from "./image_tag";
import {
    ImageTagGroupDataAccessorImpl,
    IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN,
} from "./image_tag_group";
import {
    ImageTagGroupHasImageTypeDataAccessorImpl,
    IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
} from "./image_tag_group_has_image_type";
import {
    IMAGE_TYPE_DATA_ACCESSOR_TOKEN,
    ImageTypeDataAccessorImpl,
} from "./image_type";
import { KNEX_INSTANCE_TOKEN, newKnexInstance } from "./knex";
import { RegionDataAccessorImpl, REGION_DATA_ACCESSOR_TOKEN } from "./region";
import {
    RegionLabelDataAccessorImpl,
    REGION_LABEL_DATA_ACCESSOR_TOKEN,
} from "./region_label";
import {
    RegionOperationLogDataAccessorImpl,
    REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN,
} from "./region_operation_log";
import {
    RegionOperationLogDrawMetadataDataAccessorImpl,
    REGION_OPERATION_LOG_DRAW_METADATA_DATA_ACCESSOR_TOKEN,
} from "./region_operation_log_draw_metadata";
import {
    RegionOperationLogLabelMetadataDataAccessorImpl,
    REGION_OPERATION_LOG_LABEL_METADATA_DATA_ACCESSOR_TOKEN,
} from "./region_operation_log_label_metadata";
import {
    REGION_SNAPSHOT_DATA_ACCESSOR_TOKEN,
    RegionSnapshotDataAccessorImpl,
} from "./region_snapshot";

export * from "./image_has_image_tag";
export * from "./image_tag_group_has_image_type";
export * from "./image_tag_group";
export * from "./image_tag";
export * from "./image_type";
export * from "./image";
export * from "./models";
export * from "./region_label";
export * from "./region_operation_log_draw_metadata";
export * from "./region_operation_log_label_metadata";
export * from "./region_operation_log";
export * from "./region_snapshot";
export * from "./region";

export function bindToContainer(container: Container): void {
    container
        .bind(KNEX_INSTANCE_TOKEN)
        .toInstance(newKnexInstance)
        .inSingletonScope();
    container
        .bind(IMAGE_HAS_IMAGE_TAG_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageHasImageTagDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_TAG_GROUP_HAS_IMAGE_TYPE_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageTagGroupHasImageTypeDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_TAG_GROUP_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageTagGroupDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_TAG_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageTagDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_TYPE_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageTypeDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(IMAGE_DATA_ACCESSOR_TOKEN)
        .toInstance(ImageDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_LABEL_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionLabelDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_OPERATION_LOG_DRAW_METADATA_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionOperationLogDrawMetadataDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_OPERATION_LOG_LABEL_METADATA_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionOperationLogLabelMetadataDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_OPERATION_LOG_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionOperationLogDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionDataAccessorImpl)
        .inSingletonScope();
    container
        .bind(REGION_SNAPSHOT_DATA_ACCESSOR_TOKEN)
        .toInstance(RegionSnapshotDataAccessorImpl)
        .inSingletonScope();
}
