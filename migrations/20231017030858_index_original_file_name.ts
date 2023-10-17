import { Knex } from "knex";

const TabNameImageServiceImage = "image_service_image_tab";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable(TabNameImageServiceImage, (tab) => {
        tab.index(["original_file_name"], "image_service_image_original_file_name_idx");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable(TabNameImageServiceImage, (tab) => {
        tab.dropIndex(["original_file_name"], "image_service_image_original_file_name_idx");
    });
}
