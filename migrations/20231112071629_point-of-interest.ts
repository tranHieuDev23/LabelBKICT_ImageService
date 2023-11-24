import { Knex } from "knex";

const TabNameImageServicePointOfInterest = "image_service_point_of_interest_tab";
const TabNameImageServiceImage = "image_service_image_tab";

export async function up(knex: Knex): Promise<void> {
    if (!(await knex.schema.hasTable(TabNameImageServicePointOfInterest))) {
        await knex.schema.createTable(TabNameImageServicePointOfInterest, (tab) => {
            tab.increments("point_of_interest_id", { primaryKey: true });
            tab.integer("of_image_id").notNullable();
            tab.integer("created_by_user_id").notNullable();
            tab.bigInteger("created_time").notNullable();
            tab.bigInteger("updated_time").notNullable();
            tab.decimal("x").notNullable();
            tab.decimal("y").notNullable();
            tab.text("description").notNullable().defaultTo("");

            tab.foreign("of_image_id").references("image_id").inTable(TabNameImageServiceImage).onDelete("CASCADE");

            tab.index(["of_image_id"], "image_service_point_of_interest_of_image_id_idx");
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists(TabNameImageServicePointOfInterest);
}
