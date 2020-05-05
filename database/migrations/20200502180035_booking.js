const TABLE_NAME = 'booking';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.date('startDate');
    table.date('endDate');
    table.string('acknowledge');
    table.string('property');
    table.string('unit');
    table.string('channel');
    table.integer('commission');
    table.integer('adult');
    table.integer('children1');
    table.integer('children2');
    table.integer('noGuest').defaultTo(0);
    table.string('notes1');
    table.string('notes2');
    table.integer('discount');
    table.integer('pricePerNight');
    table.string('services');
    table.integer('deposit');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
