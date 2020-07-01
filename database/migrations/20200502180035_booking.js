const TABLE_NAME = 'booking';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.integer('propertyId').notNull().unsigned();
    table.integer('unitId').notNull().unsigned();
    table.string('propertyName');
    table.string('unitName');
    table.date('startDate');
    table.date('endDate');
    table.string('acknowledge');
    table.string('channel');
    table.integer('commission');
    table.integer('adult');
    table.integer('children1');
    table.integer('children2');
    table.string('guest');
    table.integer('noOfGuest').defaultTo(0);
    table.string('notes1');
    table.string('notes2');

    table.integer('perNight');
    table.integer('night');
    table.integer('amt');
    table.string('discountType');
    table.integer('discount');
    table.integer('accomodation');

    table.string('noOfservices');
    table.integer('totalAmount');
    table.integer('deposit');
    table.string('depositType');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('propertyId').references('property.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.foreign('unitId').references('unit.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
