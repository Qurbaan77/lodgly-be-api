const knex = require('knex');
const config = require('config');

const createConnection = () => {
  let connection;

  return (invalidate = false) => {
    if (connection === undefined || invalidate) {
      connection = knex(config.get('database'));
    }
    return connection;
  };
};

exports.getConnection = createConnection();

exports.transaction = (handler) => exports.getConnection().transaction(handler);

exports.select = (table, condition) => exports.getConnection().select().from(table).where(condition);

exports.selectCol = (columns, table, condition) => exports.getConnection().select(columns).from(table).where(condition);

exports.selectOr = (table, condition) => exports.getConnection().select().from(table).orWhere(condition);

exports.insert = async (table, data) => exports.getConnection().insert(data).into(table);

exports.update = async (table, data, condition) => exports.getConnection().where(condition).update(data).into(table);

exports.remove = async (table, condition) => exports.getConnection().where(condition).into(table).del();

exports.increment = async (table, condition, value) => {
  exports.getConnection().where(condition).increment(value).into(table);
};

exports.decrement = async (table, condition, value) => {
  exports.getConnection().where(condition).decrement(value).into(table);
};
