const schedule = require('node-schedule');
const axios = require('axios');
const DB = require('../services/database');

const cronJob = schedule.scheduleJob('00 00 12 0-6', async () => {
  try {
    const response = await axios.get('https://api.exchangeratesapi.io/latest?symbols=GBP,PLN,CHF');
    await DB.update('exchangeRate', response.data.rates, {});
  } catch (error) {
    console.log(error);
  }
});

const i = async () => {
  try {
    const response = await axios.get('https://api.exchangeratesapi.io/latest?symbols=GBP,PLN,CHF');
    await DB.update('exchangeRate', response.data.rates, {});
  } catch (error) {
    console.log(error);
  }
};

module.exports = { cronJob, i };
