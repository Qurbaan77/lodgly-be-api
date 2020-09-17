const axios = require('axios');
const configs = require('./configs');

const RURequest = (method) => axios.post(configs.endpoint, method, configs.options);

module.exports = RURequest;
