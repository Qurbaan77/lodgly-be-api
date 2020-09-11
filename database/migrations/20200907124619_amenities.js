const TABLE_NAME = 'amenities';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.integer('id');
  table.string('name');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
