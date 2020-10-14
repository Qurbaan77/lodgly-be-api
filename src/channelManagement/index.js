/* This file will update rates and bookings on channex */
// const Config = require('config');
const axios = require('axios');
const NodeCache = require('node-cache');
// const DB = require('../services/database');
const getConfig = require('../channexIntegration/config');
// const auth = require('../channexIntegration/authorization');

// const user = Config.get('CHANNEX_USER');
// const password = Config.get('CHANNEX_PASSWORD');
const myCache = new NodeCache();

/**  This function will update the rate on channex
/** @param propertyId String
 *  @param ratePlanId String
 *  @param date format of date YYYY-MM-DD
 *  @returns success message with 200 code(if entities are correct)
 */
const updateRate = async (propertyId, ratePlanId, dateFrom, dateTo, rate) => {
  try {
    const token = myCache.get('token');
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
    console.log('rate response', res);
    return res;
  } catch (e) {
    console.log(e);
    return e;
  }
};

// This function will push booking to channex
/**
 * @param ratePlanId String
 * @param bookingData Object of booking deatils
 * @returns object with booking data
 */
const pushBooking = async (ratePlanId, bookingData) => {
  try {
    const token = myCache.get('token');
    const payload = {
      booking: {
        status: 'new',
        channel_id: '6496cbb9-f4d4-48ea-ab47-ff253c6163e9',
        reservation_id: bookingData.id,
        arrival_date: bookingData.startDate,
        departure_date: bookingData.endDate,
        currency: 'EUR',
        customer: {
          name: bookingData.guest,
        },
        rooms: [
          {
            occupancy: {
              adults: bookingData.adult,
              children: bookingData.children,
              infants: bookingData.infants,
            },
            rate_plan_id: ratePlanId,
            days: bookingData.days,
          },
        ],
      },
    };
    const config = getConfig('post', 'bookings/push', token, payload);
    console.log('push booking config', config);
    const res = await axios(config);
    console.log('push boking', res);
    return res;
  } catch (e) {
    console.log(e);
    return e;
  }
};
module.exports = {
  updateRate,
  pushBooking,
};
