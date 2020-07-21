const TABLE_NAME = 'unit';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id', 1000);
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.integer('unittypeId').notNull().unsigned();
  table.string('unitName');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('unittypeId').references('unitType.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
