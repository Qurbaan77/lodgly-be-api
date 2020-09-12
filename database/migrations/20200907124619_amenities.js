const TABLE_NAME = 'amenities';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments().unsigned().primary();
  table.string('name');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
