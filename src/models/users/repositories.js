const { select } = require('../../services/database');
const { TABLE_NAME } = require('./constants');

exports.getOneBy = (condition) => select(TABLE_NAME, condition);
