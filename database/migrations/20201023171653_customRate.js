const TABLE_NAME = 'customRate';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments('id');
  table.integer('unitTypeId').notNull().unsigned();
  table.date('startDate');
  table.date('endDate');
  table.string('rateType');
  table.integer('price_per_night').defaultTo(0);
  table.integer('minimum_stay').defaultTo(0);
  table.foreign('unitTypeId').references('unitTypeV2.id').onUpdate('CASCADE').onDelete('CASCADE');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
