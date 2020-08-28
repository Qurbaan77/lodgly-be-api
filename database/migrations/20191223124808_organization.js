const TABLE_NAME = 'organizations';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.string('name');
  table.string('companyName');
  table.string('planType');
  table.string('address');
  table.string('country');
  table.string('state');
  table.string('city');
  table.integer('zip');
  table.integer('vatId');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
