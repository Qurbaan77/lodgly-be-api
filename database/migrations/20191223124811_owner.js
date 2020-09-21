const TABLE_NAME = 'owner';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.string('fname');
  table.string('lname');
  table.string('email');
  table.bigInteger('phone');
  table.date('dob');
  table.string('gender');
  table.string('country');
  table.string('citizenship');
  table.string('address');
  table.string('typeofdoc');
  table.string('docNo');
  table.string('properties');
  table.string('notes');
  table.string('image');
  table.string('verificationhex');
  table.boolean('isvalid').defaultTo(false);
  table.boolean('isaccess').defaultTo(false);
  table.string('forgetPassHex');
  table.string('encrypted_password');

  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
