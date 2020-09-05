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

// const i = async () => {
//   try {
//     const response = await axios.get('https://api.exchangeratesapi.io/latest?symbols=GBP,PLN,CHF');
//     const data = await DB.select('exchangeRate', {});
//     if (data && data.length > 0) {
//       await DB.update('exchangeRate', response.data.rates, {});
//     } else {
//       await DB.insert('exchangeRate', response.data.rates, {});
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

const seed = async () => {
  try {
    const basicPayload = {
      planType: 'basic',
      booking: 1,
      calendar: 1,
      properties: 1,
      team: 1,
      invoice: 1,
      stats: 1,
      owner: 1,
      guests: 1,
      websideBuilder: 0,
      channelManager: 0,
    };
    const advancePayload = {
      planType: 'advance',
      booking: 1,
      calendar: 1,
      properties: 1,
      team: 1,
      invoice: 1,
      stats: 1,
      owner: 1,
      guests: 1,
      websideBuilder: 1,
      channelManager: 1,
    };
    const data = await DB.select('plan', { planType: 'basic' });
    if (data && data.length > 0) {
      await DB.update('plan', basicPayload, { planType: 'basic' });
      await DB.update('plan', advancePayload, { planType: 'advance' });
    } else {
      await DB.insert('plan', basicPayload);
      await DB.insert('plan', advancePayload);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = { cronJob, seed };
