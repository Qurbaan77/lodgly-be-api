const TABLE_NAME = 'invoice';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.date('date');
  table.string('time');
  table.date('deliveryDate');
  table.date('dueDate');
  table.string('paymentType');
  table.string('clientName');
  table.string('email');
  table.string('address');
  table.integer('vat');
  table.string('impression');
  table.string('pdfurl');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
