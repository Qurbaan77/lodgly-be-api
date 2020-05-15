const TABLE_NAME = 'invoice';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.integer('propertyId').notNull().unsigned();
    table.string('label');
    table.string('type');
    table.string('status');
    table.datetime('date');
    table.string('time');
    table.datetime('deliveryDate');
    table.datetime('dueDate');
    table.string('paymentType');
    table.string('clientName');
    table.string('email');
    table.string('address');
    table.integer('vatId');
    table.string('itemDesc');
    table.integer('amount');
    table.string('impression');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
