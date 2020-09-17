const TABLE_NAME = 'invoiceItems';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('invoiceId').notNull().unsigned();
  table.string('itemDescription');
  table.integer('quantity');
  table.integer('price');
  table.integer('amount');
  table.integer('discount');
  table.integer('discountPer');
  table.string('discountType');
  table.integer('itemTotal');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('invoiceId').references('invoice.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
