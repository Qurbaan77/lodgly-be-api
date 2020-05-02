const TABLE_NAME = 'property';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.integer('propertyNo');
    table.string('propertyName');
    table.string('propertyType');
    table.string('address');
    table.string('country');
    table.string('state');
    table.string('city');
    table.integer('zip');
    table.string('website');
    table.integer('bedrooms');
    table.integer('fullBathroom');
    table.integer('halfBathroom');
    table.integer('sqfoot');
    table.string('description');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
