const tables = require('../../src/uitls/tablesName');

exports.up = (knex) => {
  tables.forEach((tableName) => {
    knex.schema.table(tableName, (table) => {
      table.dropColumn('id');
      table.increments().unsigned().primary();
    });
  });
};

exports.down = () => {

};
