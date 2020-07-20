const TABLE_NAME = 'property';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('userId').notNull().unsigned();
  table.integer('ownerId').defaultTo(0);
  table.integer('propertyNo');
  table.string('propertyName');
  table.string('propertyType');
  table.string('address');
  table.string('country');
  table.string('state');
  table.string('city');
  table.string('zip');
  table.string('website');
  table.string('bedrooms');
  table.string('fullBathroom');
  table.string('halfBathroom');
  table.string('sqfoot');
  table.string('description');
  table.string('petPolicy');
  table.string('feature1');
  table.string('feature2');
  table.string('feature3');
  table.string('image');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
