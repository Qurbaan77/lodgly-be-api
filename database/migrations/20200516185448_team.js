const TABLE_NAME = 'team';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.string('email');
  table.string('role');
  table.boolean('bookingRead').defaultTo(false);
  table.boolean('bookingWrite').defaultTo(false);
  table.boolean('calendarRead').defaultTo(false);
  table.boolean('calendarwrite').defaultTo(false);
  table.boolean('propertiesRead').defaultTo(false);
  table.boolean('propertiesWrite').defaultTo(false);
  table.boolean('guestsRead').defaultTo(false);
  table.boolean('guestsWrite').defaultTo(false);
  table.boolean('serviceRead').defaultTo(false);
  table.boolean('serviceWrite').defaultTo(false);
  table.boolean('teamRead').defaultTo(false);
  table.boolean('teamWrite').defaultTo(false);
  table.boolean('invoicesRead').defaultTo(false);
  table.boolean('invoicesWrite').defaultTo(false);
  table.boolean('statsRead').defaultTo(false);
  table.boolean('statsWrite').defaultTo(false);
  table.boolean('ownerRead').defaultTo(false);
  table.boolean('ownerWrite').defaultTo(false);
  table.boolean('billingRead').defaultTo(false);
  table.boolean('billingWrite').defaultTo(false);
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
