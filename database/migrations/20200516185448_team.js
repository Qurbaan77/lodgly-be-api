const TABLE_NAME = 'team';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.string('email');
    table.string('role');
    table.timestamp('dates');
    table.string('guest');
    table.string('services');
    table.string('invoices');
    table.string('cashReg');
    table.string('ratesAval');
    table.string('dashboard');
    table.string('stats');
    table.string('setting');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
