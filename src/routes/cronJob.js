const schedule = require('node-schedule');
const axios = require('axios');
const DB = require('../services/database');

const cronJob = schedule.scheduleJob('00 00 12 0-6', async () => {
  try {
    const response = await axios.get('https://api.exchangeratesapi.io/latest?symbols=GBP,PLN,CHF');
    console.log(response.data.rates);
    const res = await DB.update('exchangeRate', response.data.rates, {});
    console.log(res);
  } catch (error) {
    console.log(error);
  }
});

const i = async () => {
  try {
    const response = await axios.get('https://api.exchangeratesapi.io/latest?symbols=GBP,PLN,CHF');
    console.log(response.data.rates);

    const res = await DB.insert('exchangeRate', response.data.rates, {});
    console.log(res);
  } catch (error) {
    console.log(error);
  }
};

module.exports = { cronJob, i };
