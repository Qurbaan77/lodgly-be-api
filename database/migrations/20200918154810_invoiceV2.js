const TABLE_NAME = 'invoiceV2';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments().unsigned().primary();
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.string('label');
  table.date('date');
  table.string('time');
  table.date('deliveryDate');
  table.date('dueDate');
  table.string('paymentType');
  table.string('clientName');
  table.string('email');
  table.string('address');
  table.string('vat');
  table.string('impression');
  table.string('pdfurl');
  table.integer('total');
  table.string('status');
  table.string('type');
  table.string('logo');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('propertyV2.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
