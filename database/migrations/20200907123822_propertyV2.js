const TABLE_NAME = 'propertyV2';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.integer('ownerId').defaultTo(0);
  table.string('propertyName');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
