const TABLE_NAME = 'channelManager';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments().unsigned().primary();
  table.integer('unitTypeId').notNull().unsigned();
  table.string('channexGroupId');
  table.string('channexPropertyId');
  table.string('channexUnitTypeId');
  table.string('channexRatePlanId');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('unitTypeId').references('unitTypeV2.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
