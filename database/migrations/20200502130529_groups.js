const TABLE_NAME = 'groups';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.string('groupName');
  table.integer('checkCount');
  table.string('checkInterval');
  table.boolean('onlyFreeDays').defaultTo(false);
  table.date('prevCheck');
  table.date('nextCheck');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
