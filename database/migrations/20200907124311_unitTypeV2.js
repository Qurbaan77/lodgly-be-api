const TABLE_NAME = 'unitTypeV2';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id', 500);
  table.integer('userId').notNull().unsigned();
  table.integer('propertyId').notNull().unsigned();
  table.integer('ownerId').defaultTo(0);
  table.json('unitTypeName');
  table.json('description');
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
  table.json('address');
  table.json('country');
  table.json('state');
  table.json('city');
  table.string('zip');
  table.decimal('lattitude').defaultTo(0);
  table.decimal('longitude').defaultTo(0);
  table.string('direction');
  table.string('distanceIn').defaultTo('km');
  table.json('distance');
  table.json('languages');
  table.string('website');
  table.string('image');
  table.boolean('isChannelManagerActivated').defaultTo(false);
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.foreign('propertyId').references('propertyV2.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
