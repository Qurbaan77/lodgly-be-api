const TABLE_NAME = 'subscription';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.string('productId');
    table.string(' planId');
    table.string('customerId');
    table.string('subscriptionId');
    table.string('subscription');
    table.integer('units');
    table.integer('Amount');
    table.string('interval');
    table.string('planType');
    table.string('currency');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
