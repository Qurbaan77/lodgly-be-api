const { Sequelize } = require('sequelize');


module.exports = new Sequelize('lodgly', 'root', 'lodgly_10', {
  host: '192.168.99.100',
  dialect: 'mysql'
});