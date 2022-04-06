import { Knex } from "knex";

const TabNameImageServiceUserBookmarksImage =
    "image_service_user_bookmarks_image";
const TabNameImageServiceImage = "image_service_image_tab";

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasTable(TabNameImageServiceUserBookmarksImage))) {
        await knex.schema.createTable(
            TabNameImageServiceUserBookmarksImage,
            (tab) => {
                tab.integer("user_id").notNullable();
                tab.integer("image_id").notNullable();
                tab.text("description").notNullable();

                tab.foreign("image_id")
                    .references("image_id")
                    .inTable(TabNameImageServiceImage)
                    .onDelete("CASCADE");

                tab.primary(["user_id", "image_id"]);
            }
        );
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTable(TabNameImageServiceUserBookmarksImage);
}
