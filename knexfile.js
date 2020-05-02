const config = require('config');

module.exports = {
  ...config.get('database'),
  migrations: {
    tableName: 'migrations',
    directory: './database/migrations',
  },
};
