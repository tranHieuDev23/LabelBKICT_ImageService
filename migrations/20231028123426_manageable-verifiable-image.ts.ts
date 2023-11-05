import { Knex } from "knex";

const TabNameImageServiceUserCanManageImage = "image_service_user_can_manage_image";
const TabNameImageServiceUserCanVerifyImage = "image_service_user_can_verify_image";
const TabNameImageServiceImage = "image_service_image_tab";

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasTable(TabNameImageServiceUserCanManageImage))) {
        await knex.schema.createTable(TabNameImageServiceUserCanManageImage, (tab) => {
            tab.integer("user_id").notNullable();
            tab.integer("image_id").notNullable();
            tab.boolean("can_edit").notNullable();

            tab.foreign("image_id").references("image_id").inTable(TabNameImageServiceImage).onDelete("CASCADE");

            tab.primary(["user_id", "image_id"]);
        });
    }
    if (!(await knex.schema.hasTable(TabNameImageServiceUserCanVerifyImage))) {
        await knex.schema.createTable(TabNameImageServiceUserCanVerifyImage, (tab) => {
            tab.integer("user_id").notNullable();
            tab.integer("image_id").notNullable();

            tab.foreign("image_id").references("image_id").inTable(TabNameImageServiceImage).onDelete("CASCADE");

            tab.primary(["user_id", "image_id"]);
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable(TabNameImageServiceUserCanManageImage);
    await knex.schema.dropTable(TabNameImageServiceUserCanVerifyImage);
}
