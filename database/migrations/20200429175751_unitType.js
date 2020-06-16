const TABLE_NAME = 'unitType';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id', 500);
    table.integer('userId').notNull().unsigned();
    table.integer('propertyId').notNull().unsigned();
    table.string('unitTypeName');
    table.bigInteger ('startDay');
    table.bigInteger ('endDay');
    table.integer('perNight');
    table.integer('roomsToSell');
    table.integer('minimumStay');
    table.integer('noOfUnits');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
