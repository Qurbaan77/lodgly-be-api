const TABLE_NAME = 'unit';

exports.up = (knex) =>
  knex.schema.createTable(TABLE_NAME, (table) => {
    table.increments('id');
    table.integer('unitTypeId').notNull().unsigned();
    table.string('unitName');
    table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    table.foreign('unitTypeId').references('unitType.id').onUpdate('CASCADE').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
