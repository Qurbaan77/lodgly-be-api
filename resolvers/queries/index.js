'use strict';
const test = require('./test'); //getting test queries file
const agenciesUser = require('./agenciesUser')


//export queries
module.exports = {
    ...test,
    ...agenciesUser
};
