const TABLE_NAME = 'plan';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');

  table.string('planType');
  table.boolean('booking');
  table.boolean('calendar');
  table.boolean('properties');
  table.boolean('team');
  table.boolean('invoice');
  table.boolean('stats');
  table.boolean('owner');
  table.boolean('guests');
  table.boolean('websideBuilder');
  table.boolean('channelManager');

  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
