const TABLE_NAME = 'unitTypeV2';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id', 500);
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.string('unitTypeName');
  table.string('description');
  table.string('sizeType');
  table.decimal('sizeValue').defaultTo(0);
  table.integer('bedRooms').defaultTo(0);
  table.integer('standardGuests').defaultTo(0);
  table.integer('units').defaultTo(0);
  table.string('unitsData');
  table.string('propertyType');
  table.json('amenities');
  table.json('sleepingArrangement');
  table.json('rooms');
  table.string('address');
  table.string('country');
  table.string('state');
  table.string('city');
  table.string('zip');
  table.decimal('lattitude').defaultTo(0);
  table.decimal('longitude').defaultTo(0);
  table.string('direction');
  table.string('distanceIn');
  table.json('distance');
  table.string('website');
  table.string('image');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('propertyV2.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
