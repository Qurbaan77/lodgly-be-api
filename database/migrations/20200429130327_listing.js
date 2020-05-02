const TABLE_NAME = 'listing';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('userId').notNull().unsigned();
    table.integer('propertyNo');
    table.boolean('petNegotiable').defaultTo(false);
    table.boolean('catsOk').defaultTo(false);
    table.boolean('dogsOk').defaultTo(false);
    table.boolean('noPets').defaultTo(false);
    table.boolean('doNotSpecify').defaultTo(false);
    table.boolean('furnished').defaultTo(false);
    table.boolean('washer').defaultTo(false);
    table.boolean('parking').defaultTo(false);
    table.boolean('gym').defaultTo(false);
    table.boolean('AC').defaultTo(false);
    table.boolean('hardwoodFloor').defaultTo(false);
    table.boolean('firePlace').defaultTo(false);
    table.boolean('dishWasher').defaultTo(false);
    table.boolean('storage').defaultTo(false);
    table.boolean('walkInCloset').defaultTo(false);
    table.boolean('pool').defaultTo(false);
    table.boolean('hotTub').defaultTo(false);
    table.boolean('outdoorSpace').defaultTo(false);
    table.boolean('sharedYard').defaultTo(false);
    table.boolean('privateYard').defaultTo(false);
    table.boolean('patio').defaultTo(false);
    table.boolean('balcony').defaultTo(false);
    table.boolean('garden').defaultTo(false);
    table.boolean('wheelchair').defaultTo(false);

    table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
