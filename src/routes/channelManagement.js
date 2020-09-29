/* eslint-disable camelcase */
const express = require('express');
const Config = require('config');
const axios = require('axios');
const auth = require('../channexIntegration/authorization');
const getConfig = require('../channexIntegration/config');
const DB = require('../services/database');
const { updateRate } = require('../channelManagement');
// const { userAuthCheck } = require('../middlewares/middlewares');

const channelRouter = () => {
  const router = express.Router();
  const user = Config.get('CHANNEX_USER');
  const password = Config.get('CHANNEX_PASSWORD');
  let token;

  /* pushing property data to channex starts here */

  // this function will create group on channex
  const createGroup = async (name) => {
    const payload = {
      group: {
        title: name,
      },
    };
    const config = await getConfig('post', 'groups', token, payload);
    const res = await axios(config);
    return res.data.data.id;
  };
  // this function will create property on channex
  const createProperty = async (propertyData, groupId) => {
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
  };

  // This function will create unit Type(our unit Type is same as their room Type) on channex
  const createUnitType = async (propertyId, unitTypeData) => {
    const payload = {
      room_type: {
        property_id: propertyId,
        title: unitTypeData.unitTypeName,
        count_of_rooms: unitTypeData.units,
        occ_adults: unitTypeData.standardGuests,
        occ_children: unitTypeData.childBed,
        occ_infants: unitTypeData.babyCrib,
        default_occupancy: unitTypeData.standardGuests,
        content: {
          description: unitTypeData.description,
        },
      },
    };
    const config = await getConfig('post', 'room_types', token, payload);
    const res = await axios(config);
    return res.data.data.id;
  };

  // Function to create rate plans on channex
  const createRatePlan = async (propertyId, unitTypeId, ratesData) => {
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
  };

  // A single API to push all property data to channex
  router.post('/pushProperty', async (req, res) => {
    try {
      token = await auth(user, password);
      const userData = await DB.select('users', { id: 1 });
      const [{
        email, phone, companyName,
      }] = userData;
      const data = await DB.select('unitTypeV2', { id: req.body.unitTypeV2Id });
      console.log('unit Type data', data[0].unitTypeName[0].name);
      console.log('unit Type data', data[0].description[0].description);
      const [{
        country, state, city, zip,
        lattitude, longitude, image, address, standardGuests, units,
      }] = data;
      const { name: unitTypeName } = data[0].unitTypeName[0];
      const { description } = data[0].description[0];
      const { sleepingArrangement } = data[0];
      const babyCrib = JSON.parse(sleepingArrangement.babyCrib);
      const childBed = JSON.parse(sleepingArrangement.childBed);
      const rateData = await DB.select('ratesV2', { unitTypeId: req.body.unitTypeV2Id });
      console.log(rateData);
      const [{
        rateName, price_per_night, minimum_stay, checkIn_on_monday,
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
        currency: 'eur',
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
      const groupId = await createGroup(companyName);
      console.log(groupId);
      const propertyId = await createProperty(propertyData, groupId);
      console.log(propertyId);
      const unitTypeId = await createUnitType(propertyId, unitTypeData);
      console.log(unitTypeId);
      const ratePlanId = await createRatePlan(propertyId, unitTypeId, ratesData);
      console.log(ratePlanId);
      const seasonRatesData = await DB.select('seasonRatesV2', { unitTypeId: req.body.unitTypeV2Id });
      if (seasonRatesData && seasonRatesData.length > 0) {
        const [{ startDate, endDate, price_per_night: rate }] = seasonRatesData;
        await updateRate(propertyId, unitTypeId, startDate, endDate, rate * 100);
      }
      const payload = {
        unitTypeId: req.body.unitTypeV2Id,
        channexGroupId: groupId,
        channexPropertyId: propertyId,
        channexUnitTypeId: unitTypeId,
        channexRatePlanId: ratePlanId,
      };
      await DB.insert('channelManager', payload);
      await DB.update('unitTypeV2', { isChannelManagerActivated: true }, { id: req.body.unitTypeV2Id });
      res.send({
        code: 200,
        msg: 'Channel manager activated',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'wrong entity passed',
      });
    }
  });

  return router;
};
module.exports = channelRouter;
