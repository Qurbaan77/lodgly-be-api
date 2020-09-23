const TABLE_NAME = 'guestV2';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.integer('bookingId').unsigned();
  table.integer('reservationId').unsigned();
  table.string('fullname');
  table.string('country');
  table.string('email');
  table.bigInteger('phone');
  table.date('dob');
  table.string('gender');
  table.string('typeOfDoc');
  table.string('docNo');
  table.string('citizenShip');
  table.string('place');
  table.string('notes');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('bookingId').references('bookingV2.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('reservationId').references('reservationV2.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
