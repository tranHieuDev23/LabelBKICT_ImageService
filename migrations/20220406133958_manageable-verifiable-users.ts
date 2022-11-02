import { Knex } from "knex";

const TabNameImageServiceUserCanManageUserImage =
    "image_service_user_can_manage_user_image";
const TabNameImageServiceUserCanVerifyUserImage =
    "image_service_user_can_verify_user_image";

export async function up(knex: Knex): Promise<void> {
    if (
        !(await knex.schema.hasTable(TabNameImageServiceUserCanManageUserImage))
    ) {
        await knex.schema.createTable(
            TabNameImageServiceUserCanManageUserImage,
            (tab) => {
                tab.integer("user_id").notNullable();
                tab.integer("image_of_user_id").notNullable();
                tab.boolean("can_edit").notNullable();

                tab.primary(["user_id", "image_of_user_id"]);
            }
        );
    }
    if (
        !(await knex.schema.hasTable(TabNameImageServiceUserCanVerifyUserImage))
    ) {
        await knex.schema.createTable(
            TabNameImageServiceUserCanVerifyUserImage,
            (tab) => {
                tab.integer("user_id").notNullable();
                tab.integer("image_of_user_id").notNullable();

                tab.primary(["user_id", "image_of_user_id"]);
            }
        );
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable(TabNameImageServiceUserCanManageUserImage);
    await knex.schema.dropTable(TabNameImageServiceUserCanVerifyUserImage);
}
