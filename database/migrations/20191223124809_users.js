const TABLE_NAME = 'users';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('organizationId').notNull().unsigned();
  table.string('fullname');
  table.string('email');
  table.string('companyName');
  table.string('phone');
  table.string('username');
  table.string('fname');
  table.string('lname');
  table.string('address');
  table.string('package');
  table.string('image');
  table.string('requestedUnits');
  table.boolean('isSubscribed').defaultTo(false);
  table.boolean('isOnTrial').defaultTo(true);
  table.boolean('isSubscriptionEnded').defaultTo(false);
  table.string('verificationhex');
  table.boolean('isvalid').defaultTo(false);
  table.string('forgetPassHex');
  table.string('encrypted_password');
  table.string('timeZone');
  table.datetime('trialEnded');
  table.foreign('organizationId').references('organizations.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
