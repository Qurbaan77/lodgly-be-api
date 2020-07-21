const TABLE_NAME = 'exchangeRate';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
    table.decimal('CHF').notNull();
    table.decimal('PLN').notNull();
    table.decimal('GBP').notNull();
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
