/* This file will update rates and bookings on channex */
const Config = require('config');
const axios = require('axios');
// const DB = require('../services/database');
const getConfig = require('../channexIntegration/config');
const auth = require('../channexIntegration/authorization');

// This function will update the rate on channex
/** @param propertyId String
 *  @param ratePlanId String
 *  @param date format of date YYYY-MM-DD
 */
const updateRate = async (propertyId, ratePlanId, dateFrom, dateTo, rate) => {
  const user = Config.get('CHANNEX_USER');
  const password = Config.get('CHANNEX_PASSWORD');
  const token = await auth(user, password);
  const payload = {
    values: [{
      property_id: propertyId,
      rate_plan_id: ratePlanId,
      date_from: dateFrom,
      date_to: dateTo,
      rate,
    }],
  };
  const config = getConfig('post', 'restrictions', token, payload);
  console.log(config);
  const res = await axios(config);
  return res;
};

// This function will push booking to channex
/**
 * TODO push booking to channex with dyanmic data coming from API
 */
// const pushBooking = () => {

// };
module.exports = updateRate;
