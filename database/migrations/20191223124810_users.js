const TABLE_NAME = 'users';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    // table.integer('organization_id').notNull().unsigned();
    // table.integer('user_id').notNull().unsigned();
    table.string('email');
    table.string('phone');
    table.string('username');
    table.string('package');
    table.string('verificationhex');
    table.boolean('isvalid').defaultTo(false);
    table.string('forgetPassHex');
    table.string('encrypted_password');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    // table.foreign('user_id').references('users.id')
    //   .onUpdate('CASCADE')
    //   .onDelete('CASCADE');

    // table.foreign('organization_id').references('organizations.id')
    //   .onUpdate('CASCADE')
    //   .onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
