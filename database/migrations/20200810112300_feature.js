const TABLE_NAME = 'feature';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');

  table.integer('organizationId').notNull().unsigned();
  table.boolean('booking').defaultTo(true);
  table.boolean('calendar').defaultTo(true);
  table.boolean('properties').defaultTo(true);
  table.boolean('team').defaultTo(true);
  table.boolean('invoice').defaultTo(true);
  table.boolean('stats').defaultTo(true);
  table.boolean('owner').defaultTo(true);
  table.boolean('guests').defaultTo(true);
  table.boolean('websideBuilder').defaultTo(true);
  table.boolean('channelManager').defaultTo(true);

  table.foreign('organizationId').references('organizations.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
