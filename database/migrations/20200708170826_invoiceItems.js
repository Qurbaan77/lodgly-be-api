const TABLE_NAME = 'invoiceItems';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('invoiceId').notNull().unsigned();
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
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('invoiceId').references('invoice.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
