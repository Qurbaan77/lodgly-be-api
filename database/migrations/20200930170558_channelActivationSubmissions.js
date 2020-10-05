const TABLE_NAME = 'channelActivationSubmissions';

exports.up = (knex) => knex.schema.createTable(TABLE_NAME, (table) => {
  table.increments().unsigned().primary();
  table.integer('userId').notNull().unsigned();
  table.string('email');
  table.json('propertiesToMap');
  table.string('channelToMap');
  table.string('airbnbUsername');
  table.string('airbnbPassowrd');
  table.timestamp('created_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  table.timestamp('updated_at').notNull().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  table.foreign('userId').references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
});

exports.down = (knex) => knex.schema.dropTable(TABLE_NAME);
