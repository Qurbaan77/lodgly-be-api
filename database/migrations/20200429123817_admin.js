const TABLE_NAME = 'admin';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.string('email');
    table.string('encrypted_password');
    table.string('phone');
    table.string('verificationhex');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
