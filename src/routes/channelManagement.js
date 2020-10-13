/* eslint-disable camelcase */
const express = require('express');
const Config = require('config');
const axios = require('axios');
const each = require('sync-each');
const auth = require('../channexIntegration/authorization');
const getConfig = require('../channexIntegration/config');
const DB = require('../services/database');
const { updateRate } = require('../channelManagement');
const { userAuthCheck } = require('../middlewares/middlewares');

const channelRouter = () => {
  const router = express.Router();
  const user = Config.get('CHANNEX_USER');
  const password = Config.get('CHANNEX_PASSWORD');
  let token;

  /* pushing property data to channex starts here */

  // this function will create group on channex
  const createGroup = async (name) => {
    try {
      const payload = {
        group: {
          title: name,
        },
      };
      const config = await getConfig('post', 'groups', token, payload);
      const res = await axios(config);
      return res.data.data.id;
    } catch (e) {
      console.log(e);
      return e;
    }
  };
  // this function will create property on channex
  const createProperty = async (propertyData, groupId) => {
    try {
      const payload = {
        property: {
          title: propertyData.unitTypeName,
          currency: 'EUR',
          email: propertyData.email,
          phone: propertyData.phone,
          zip_code: propertyData.zip,
          country: propertyData.country,
          state: propertyData.state,
          city: propertyData.city,
          address: propertyData.address,
          longitude: propertyData.longitude,
          latitude: propertyData.lattitude,
          group_id: groupId,
          content: {
            description: propertyData.description,
            photos: [{
              url: propertyData.image,
              position: 0,
            }],
          },
        },
      };
      const config = await getConfig('post', 'properties', token, payload);
      const res = await axios(config);
      return res.data.data.id;
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  // This function will create unit Type(our unit Type is same as their room Type) on channex
  const createUnitType = async (propertyId, unitTypeData) => {
    try {
      const payload = {
        room_type: {
          property_id: propertyId,
          title: unitTypeData.unitTypeName,
          count_of_rooms: unitTypeData.units || 0,
          occ_adults: unitTypeData.standardGuests || 0,
          occ_children: unitTypeData.childBed || 0,
          occ_infants: unitTypeData.babyCrib || 0,
          default_occupancy: unitTypeData.standardGuests || 0,
          content: {
            description: unitTypeData.description,
          },
        },
      };
      const config = await getConfig('post', 'room_types', token, payload);
      const res = await axios(config);
      return res.data.data.id;
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  // Function to create rate plans on channex
  const createRatePlan = async (propertyId, unitTypeId, ratesData) => {
    try {
      const payload = {
        rate_plan: {
          title: ratesData.rateName,
          property_id: propertyId,
          room_type_id: unitTypeId,
          parent_rate_plan_id: null,
          children_fee: 0.00,
          infant_fee: 0.00,
          options: [
            {
              occupancy: ratesData.standardGuests,
              is_primary: true,
              rate: ratesData.price_per_night.toString(),
            },
          ],
          currency: ratesData.currency,
          sell_mode: 'per_room',
          rate_mode: 'manual',
          closed_to_arrival: [false, false, false, false, false, false, false],
          closed_to_departure: [false, false, false, false, false, false, false],
          stop_sell: [false, false, false, false, false, false, false],
          // min_stay_arrival: ratesData.minimum_stay,
          // max_stay: [0, 0, 0, 0, 0, 0, 0],
          max_sell: null,
          max_availability: null,
          availability_offset: null,
          inherit_rate: false,
          inherit_closed_to_arrival: false,
          inherit_closed_to_departure: false,
          inherit_stop_sell: false,
          inherit_min_stay_arrival: false,
          inherit_max_stay: false,
          inherit_max_sell: false,
          inherit_max_availability: false,
          inherit_availability_offset: false,
          auto_rate_settings: null,
        },
      };
      const config = await getConfig('post', 'rate_plans', token, payload);
      const res = await axios(config);
      return res.data.data.id;
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  // A single API to push all property data to channex(one API to rule them all)
  router.post('/activateChannel', userAuthCheck, async (req, res) => {
    try {
      console.log(req.body);
      const { body } = req;
      token = await auth(user, password);
      const userData = await DB.select('users', { id: body.tokenData.userid });
      const [{
        email, phone, companyName,
      }] = userData;
      const groupId = await createGroup(companyName);
      console.log(groupId);
      const submissionpayload = {
        userId: body.tokenData.userid,
        email: body.email,
        propertiesToMap: JSON.stringify(body.properties),
        channelToMap: body.channelToMap,
        airbnbUsername: body.airbnbUsername,
        airbnbPassword: body.airbnbPassword,
      };
      await DB.insert('channelActivationSubmissions', submissionpayload);
      each(
        body.properties,
        async (propertyId, next) => {
          try {
            const data = await DB.select('unitTypeV2', { propertyId: parseInt(propertyId, 10) });
            //  console.log('unit Type data', data[0].unitTypeName[0].name);
            // console.log('unit Type data', data[0].description[0].description);
            const [{
              id: unitTypeV2Id, country, state, city, zip,
              lattitude, longitude, image, address, standardGuests, units,
            }] = data;
            const { name: unitTypeName } = data[0].unitTypeName[0];
            const { description } = data[0].description[0];
            const { sleepingArrangement } = data[0];
            const babyCrib = sleepingArrangement && JSON.parse(sleepingArrangement.babyCrib);
            const childBed = sleepingArrangement && JSON.parse(sleepingArrangement.childBed);
            const rateData = await DB.select('ratesV2', { unitTypeId: unitTypeV2Id });
            // console.log(rateData);
            const [{
              rateName, currency, price_per_night, minimum_stay, checkIn_on_monday,
              checkIn_on_tuesday, checkIn_on_wednesday, checkIn_on_thursday,
              checkIn_on_friday, checkIn_on_saturday, checkIn_on_sunday,
              checkOut_on_monday, checkOut_on_tuesday,
              checkOut_on_wednesday,
              checkOut_on_thursday,
              checkOut_on_friday, checkOut_on_saturday,
              checkOut_on_sunday,
              minimum_stay_on_monday,
              minimum_stay_on_tuesday,
              minimum_stay_on_wednesday,
              minimum_stay_on_thursday, minimum_stay_on_friday, minimum_stay_on_saturday, minimum_stay_on_sunday,
            }] = rateData;
            const propertyData = {
              email,
              phone,
              unitTypeName,
              description,
              country,
              state,
              city,
              zip,
              lattitude,
              longitude,
              image,
              address,
            };
            const unitTypeData = {
              unitTypeName,
              description,
              units,
              standardGuests,
              babyCrib,
              childBed,
            };
            const ratesData = {
              rateName,
              currency,
              price_per_night,
              standardGuests,
              checkIn_Restriction: [checkIn_on_monday === 1,
                checkIn_on_tuesday === 1, checkIn_on_wednesday === 1, checkIn_on_thursday === 1,
                checkIn_on_friday === 1, checkIn_on_saturday === 1, checkIn_on_sunday === 1],
              checkOut_Restriction: [
                checkOut_on_monday === 1,
                checkOut_on_tuesday === 1,
                checkOut_on_wednesday === 1,
                checkOut_on_thursday === 1,
                checkOut_on_friday === 1, checkOut_on_saturday === 1, checkOut_on_sunday === 1],
              minimum_stay: [minimum_stay_on_monday || minimum_stay,
                minimum_stay_on_tuesday || minimum_stay,
                minimum_stay_on_wednesday || minimum_stay,
                minimum_stay_on_thursday || minimum_stay,
                minimum_stay_on_friday || minimum_stay,
                minimum_stay_on_saturday || minimum_stay,
                minimum_stay_on_sunday || minimum_stay],
            };
            console.log('properties data', propertyData);
            console.log('unit Type Data', unitTypeData);
            console.log('rates data', ratesData);
            const channexPropertyId = await createProperty(propertyData, groupId);
            console.log(propertyId);
            const unitTypeId = await createUnitType(channexPropertyId, unitTypeData);
            console.log(unitTypeId);
            const ratePlanId = await createRatePlan(channexPropertyId, unitTypeId, ratesData);
            console.log(ratePlanId);
            const seasonRatesData = await DB.select('seasonRatesV2', { unitTypeId: unitTypeV2Id });
            if (seasonRatesData && seasonRatesData.length > 0) {
              const [{ startDate, endDate, price_per_night: rate }] = seasonRatesData;
              await updateRate(propertyId, unitTypeId, startDate, endDate, rate * 100);
            }
            const payload = {
              unitTypeId: unitTypeV2Id,
              channexGroupId: groupId,
              channexPropertyId,
              channexUnitTypeId: unitTypeId,
              channexRatePlanId: ratePlanId,
            };
            await DB.insert('channelManager', payload);
            const unittypepayload = {
              isChannelManagerActivated: true,
              airbnb: body.channelToMap === 'airbnb',
              booking: body.channelToMap === 'booking',
              expedia: body.channelToMap === 'expedia',
            };
            await DB.update('unitTypeV2', unittypepayload,
              { id: unitTypeV2Id });
            next();
          } catch (e) {
            console.log(e);
          }
        },
        () => {
          res.send({
            code: 200,
            msg: 'channel manager activated',
          });
        },
      );
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'wrong entity passed',
      });
    }
  });

  /**
   * API for checking if property has rates
   */
  router.post('/checkRates', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      console.log(body);
      let isEmpty = false;
      let property = '';
      each(
        body.properties,
        async (propertyId, next) => {
          const data = await DB.selectCol(['id'], 'unitTypeV2', { propertyId: parseInt(propertyId, 10) });
          const [{
            id: unitTypeV2Id,
          }] = data;
          const rateData = await DB.select('ratesV2', { unitTypeId: unitTypeV2Id });
          console.log('rates data in check rates', rateData);
          if (rateData.length < 1) {
            const data0 = await DB.selectCol(['propertyName'], 'propertyV2', { id: propertyId });
            const [{ propertyName }] = data0;
            isEmpty = true;
            property = propertyName;
          }
          next();
        },
        () => {
          if (isEmpty) {
            res.send({
              code: 401,
              msg: `property ${property} do not have any rates, either set the rates or remove it from the list`,
            });
          } else {
            res.send({
              code: 200,
              msg: 'all good',
            });
          }
        },
      );
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  /**
   * API for geting channel status of property
   */
  router.get('/channelStatus', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      const channelStatus = await DB.selectCol(['isChannelManagerActivated', 'airbnb', 'booking'], 'unitTypeV2',
        { userId: body.tokenData.userid });
      console.log(channelStatus);
      let airbnb = false;
      let booking = false;
      let expedia = false;
      each(
        channelStatus,
        (channel, next) => {
          if (!airbnb) {
            if (channel.airbnb) {
              airbnb = true;
            }
          }
          if (!booking) {
            if (channel.booking) {
              booking = true;
            }
          }
          if (!expedia) {
            if (channel.expedia) {
              expedia = true;
            }
          }
          next();
        },
        () => {
          res.send({
            code: 200,
            airbnb,
            booking,
            expedia,
          });
        },
      );
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  return router;
};
module.exports = channelRouter;
