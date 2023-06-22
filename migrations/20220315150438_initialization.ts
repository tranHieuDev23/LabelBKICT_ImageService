import { Knex } from "knex";

const TabNameImageServiceImageType = "image_service_image_type_tab";
const TabNameImageServiceRegionLabel = "image_service_region_label_tab";
const TabNameImageServiceImageTagGroup = "image_service_image_tag_group_tab";
const TabNameImageServiceImageTag = "image_service_image_tag_tab";
const TabNameImageServiceImageTagGroupHasImageType =
    "image_service_image_tag_group_has_image_type_tab";
const TabNameImageServiceImageTagGroupHasClassificationType =
    "image_service_image_tag_group_has_classification_type_tab";
const TabNameImageServiceImage = "image_service_image_tab";
const TabNameImageServiceImageHasTag = "image_service_image_has_image_tag_tab";
const TabNameImageServiceRegion = "image_service_region_tab";
const TabNameImageServiceRegionOperationLog =
    "image_service_region_operation_log_tab";
const TabNameImageServiceRegionOperationLogDrawMetadata =
    "image_service_region_operation_log_draw_metadata_tab";
const TabNameImageServiceRegionOperationLogLabelMetadata =
    "image_service_region_operation_log_label_metadata_tab";
const TabNameImageServiceRegionSnapshot = "image_service_region_snapshot_tab";

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasTable(TabNameImageServiceImageType))) {
        await knex.schema.createTable(TabNameImageServiceImageType, (tab) => {
            tab.increments("image_type_id", { primaryKey: true });
            tab.string("display_name", 256).notNullable();
            tab.boolean("has_predictive_model").notNullable();
        });
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceRegionLabel))) {
        await knex.schema.createTable(TabNameImageServiceRegionLabel, (tab) => {
            tab.increments("region_label_id", { primaryKey: true });
            tab.integer("of_image_type_id").notNullable();
            tab.string("display_name", 256).notNullable();
            tab.string("color", 7).notNullable();

            tab.foreign("of_image_type_id")
                .references("image_type_id")
                .inTable(TabNameImageServiceImageType)
                .onDelete("CASCADE");

            tab.index(
                ["of_image_type_id"],
                "image_service_region_label_of_image_type_id_idx"
            );
        });
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceImageTagGroup))) {
        await knex.schema.createTable(
            TabNameImageServiceImageTagGroup,
            (tab) => {
                tab.increments("image_tag_group_id", { primaryKey: true });
                tab.string("display_name", 256).notNullable();
                tab.boolean("is_single_value").notNullable();
            }
        );
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceImageTag))) {
        await knex.schema.createTable(TabNameImageServiceImageTag, (tab) => {
            tab.increments("image_tag_id", { primaryKey: true });
            tab.integer("of_image_tag_group_id").notNullable();
            tab.string("display_name", 256).notNullable();

            tab.foreign("of_image_tag_group_id")
                .references("image_tag_group_id")
                .inTable(TabNameImageServiceImageTagGroup)
                .onDelete("CASCADE");

            tab.index(
                ["of_image_tag_group_id"],
                "image_service_region_label_of_image_tag_group_id_idx"
            );
        });
    }

    if (
        !(await knex.schema.hasTable(
            TabNameImageServiceImageTagGroupHasImageType
        ))
    ) {
        await knex.schema.createTable(
            TabNameImageServiceImageTagGroupHasImageType,
            (tab) => {
                tab.integer("image_tag_group_id").notNullable();
                tab.integer("image_type_id").notNullable();

                tab.foreign("image_tag_group_id")
                    .references("image_tag_group_id")
                    .inTable(TabNameImageServiceImageTagGroup)
                    .onDelete("CASCADE");
                tab.foreign("image_type_id")
                    .references("image_type_id")
                    .inTable(TabNameImageServiceImageType)
                    .onDelete("CASCADE");

                tab.unique(["image_tag_group_id", "image_type_id"], {
                    indexName:
                        "image_service_image_tag_group_has_image_type_image_tag_group_id_image_type_id_idx",
                });

                tab.index(
                    ["image_type_id"],
                    "image_service_image_tag_group_has_image_type_image_type_id_idx"
                );
            }
        );
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceImage))) {
        await knex.schema.createTable(TabNameImageServiceImage, (tab) => {
            tab.increments("image_id", { primaryKey: true });
            tab.integer("uploaded_by_user_id").notNullable().defaultTo(0);
            tab.bigInteger("upload_time").notNullable().defaultTo(0);
            tab.integer("published_by_user_id").notNullable().defaultTo(0);
            tab.bigInteger("publish_time").notNullable().defaultTo(0);
            tab.integer("verified_by_user_id").notNullable().defaultTo(0);
            tab.bigInteger("verify_time").notNullable().defaultTo(0);
            tab.string("original_file_name", 256).notNullable().defaultTo("");
            tab.string("original_image_filename", 256).notNullable();
            tab.string("thumbnail_image_filename", 256).notNullable();
            tab.text("description").notNullable().defaultTo("");
            tab.integer("image_type_id").defaultTo(null);
            tab.smallint("status").notNullable().defaultTo(0);

            tab.foreign("image_type_id")
                .references("image_type_id")
                .inTable(TabNameImageServiceImageType)
                .onDelete("SET NULL");

            tab.index(["upload_time"], "image_service_image_upload_time_idx");
            tab.index(["publish_time"], "image_service_image_publish_time_idx");
            tab.index(["verify_time"], "image_service_image_verify_time_idx");
        });
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceImageHasTag))) {
        await knex.schema.createTable(TabNameImageServiceImageHasTag, (tab) => {
            tab.integer("image_id").notNullable();
            tab.integer("image_tag_id").notNullable();

            tab.foreign("image_id")
                .references("image_id")
                .inTable(TabNameImageServiceImage)
                .onDelete("CASCADE");
            tab.foreign("image_tag_id")
                .references("image_tag_id")
                .inTable(TabNameImageServiceImageTag)
                .onDelete("CASCADE");

            tab.unique(["image_id", "image_tag_id"], {
                indexName:
                    "image_service_image_has_image_tag_image_id_image_tag_id_idx",
            });

            tab.index(
                ["image_tag_id"],
                "image_service_image_has_tag_image_tag_id_idx"
            );
        });
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceRegion))) {
        await knex.schema.createTable(TabNameImageServiceRegion, (tab) => {
            tab.increments("region_id", { primaryKey: true });
            tab.integer("of_image_id").notNullable();
            tab.integer("drawn_by_user_id").notNullable().defaultTo(0);
            tab.integer("labeled_by_user_id").notNullable().defaultTo(0);
            tab.binary("border").notNullable();
            tab.binary("holes").notNullable();
            tab.integer("label_id").defaultTo(null);

            tab.foreign("of_image_id")
                .references("image_id")
                .inTable(TabNameImageServiceImage)
                .onDelete("CASCADE");
            tab.foreign("label_id")
                .references("region_label_id")
                .inTable(TabNameImageServiceRegionLabel)
                .onDelete("SET NULL");

            tab.index(["of_image_id"], "image_service_region_of_image_id_idx");
            tab.index(["label_id"], "image_service_region_label_id_idx");
        });
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceRegionOperationLog))) {
        await knex.schema.createTable(
            TabNameImageServiceRegionOperationLog,
            (tab) => {
                tab.increments("region_operation_log_id", { primaryKey: true });
                tab.integer("of_region_id").notNullable();
                tab.integer("by_user_id").notNullable().defaultTo(0);
                tab.bigInteger("operation_time").notNullable();
                tab.smallint("operation_type").notNullable();

                tab.foreign("of_region_id")
                    .references("region_id")
                    .inTable(TabNameImageServiceRegion)
                    .onDelete("CASCADE");

                tab.index(
                    ["of_region_id"],
                    "image_service_region_operation_log_of_region_id_idx"
                );
            }
        );
    }

    if (
        !(await knex.schema.hasTable(
            TabNameImageServiceRegionOperationLogDrawMetadata
        ))
    ) {
        await knex.schema.createTable(
            TabNameImageServiceRegionOperationLogDrawMetadata,
            (tab) => {
                tab.integer("of_region_operation_log_id");
                tab.binary("old_border").notNullable();
                tab.binary("old_holes").notNullable();
                tab.binary("new_border").notNullable();
                tab.binary("new_holes").notNullable();

                tab.primary(["of_region_operation_log_id"]);

                tab.foreign("of_region_operation_log_id")
                    .references("region_operation_log_id")
                    .inTable(TabNameImageServiceRegionOperationLog)
                    .onDelete("CASCADE");
            }
        );
    }

    if (
        !(await knex.schema.hasTable(
            TabNameImageServiceRegionOperationLogLabelMetadata
        ))
    ) {
        await knex.schema.createTable(
            TabNameImageServiceRegionOperationLogLabelMetadata,
            (tab) => {
                tab.integer("of_region_operation_log_id");
                tab.integer("old_label_id");
                tab.integer("new_label_id");

                tab.primary(["of_region_operation_log_id"]);

                tab.foreign("of_region_operation_log_id")
                    .references("region_operation_log_id")
                    .inTable(TabNameImageServiceRegionOperationLog)
                    .onDelete("CASCADE");
                tab.foreign("old_label_id")
                    .references("region_label_id")
                    .inTable(TabNameImageServiceRegionLabel)
                    .onDelete("SET NULL");
                tab.foreign("new_label_id")
                    .references("region_label_id")
                    .inTable(TabNameImageServiceRegionLabel)
                    .onDelete("SET NULL");
            }
        );
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceRegionSnapshot))) {
        await knex.schema.createTable(
            TabNameImageServiceRegionSnapshot,
            (tab) => {
                tab.increments("region_snapshot_id", { primaryKey: true });
                tab.integer("of_image_id").notNullable();
                tab.smallint("at_status").notNullable();
                tab.integer("drawn_by_user_id").notNullable().defaultTo(0);
                tab.integer("labeled_by_user_id").notNullable().defaultTo(0);
                tab.binary("border").notNullable();
                tab.binary("holes").notNullable();
                tab.integer("label_id").defaultTo(null);

                tab.foreign("of_image_id")
                    .references("image_id")
                    .inTable(TabNameImageServiceImage)
                    .onDelete("CASCADE");
                tab.foreign("label_id")
                    .references("region_label_id")
                    .inTable(TabNameImageServiceRegionLabel)
                    .onDelete("SET NULL");

                tab.index(
                    ["of_image_id"],
                    "image_service_region_snapshot_of_image_id_idx"
                );
            }
        );
    }

    if (!(await knex.schema.hasTable(TabNameImageServiceImageTagGroupHasClassificationType))) {
        await knex.schema.createTable(
            TabNameImageServiceImageTagGroupHasClassificationType,
            (tab) => {
                tab.integer("image_tag_group_id").notNullable();
                tab.string("classification_type_id").notNullable();

                tab.foreign("image_tag_group_id")
                    .references("image_tag_group_id")
                    .inTable(TabNameImageServiceImageTagGroup)
                    .onDelete("CASCADE");

                tab.unique(["image_tag_group_id", "classification_type_id"], {
                    indexName:
                        "image_service_image_tag_group_has_classification_type_image_tag_group_id_classification_type_id_idx",
                });

                tab.index(
                    ["classification_type_id"],
                    "image_service_image_tag_group_has_classification_type_classification_type_id_idx"
                );
            }
        )
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TabNameImageServiceRegionSnapshot);
    await knex.schema.dropTableIfExists(
        TabNameImageServiceRegionOperationLogLabelMetadata
    );
    await knex.schema.dropTableIfExists(
        TabNameImageServiceRegionOperationLogDrawMetadata
    );
    await knex.schema.dropTableIfExists(TabNameImageServiceRegionOperationLog);
    await knex.schema.dropTableIfExists(TabNameImageServiceRegion);
    await knex.schema.dropTableIfExists(TabNameImageServiceImageHasTag);
    await knex.schema.dropTableIfExists(TabNameImageServiceImage);
    await knex.schema.dropTableIfExists(
        TabNameImageServiceImageTagGroupHasImageType
    );
    await knex.schema.dropTableIfExists(
        TabNameImageServiceImageTagGroupHasClassificationType
    );
    await knex.schema.dropTableIfExists(TabNameImageServiceImageTag);
    await knex.schema.dropTableIfExists(TabNameImageServiceImageTagGroup);
    await knex.schema.dropTableIfExists(TabNameImageServiceRegionLabel);
    await knex.schema.dropTableIfExists(TabNameImageServiceImageType);
}
