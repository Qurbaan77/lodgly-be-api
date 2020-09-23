/* eslint-disable camelcase */
const express = require('express');
const Config = require('config');
const axios = require('axios');
const auth = require('../channexIntegration/authorization');
const getConfig = require('../channexIntegration/config');
const DB = require('../services/database');
// const { userAuthCheck } = require('../middlewares/middlewares');

const channelRouter = () => {
  const router = express.Router();
  const user = Config.get('CHANNEX_USER');
  const password = Config.get('CHANNEX_PASSWORD');
  let token;

  // pushing property to channex starts here

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
        email: 'hashim@yopmail.com',
        phone: '123456789',
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
            rate: `${ratesData.price_per_night * 1.00}`,
          },
        ],
        currency: ratesData.currency,
        sell_mode: 'per_room',
        rate_mode: 'manual',
        closed_to_arrival: ratesData.checkIn_Restriction,
        closed_to_departure: ratesData.checkOut_Restriction,
        stop_sell: [false, false, false, false, false, false, false],
        min_stay_arrival: ratesData.minimum_stay,
        max_stay: [0, 0, 0, 0, 0, 0, 0],
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
      const [{
        unitTypeName, description, country, state, city, zip,
        lattitude, longitude, image, address, standardGuests, units,
      }] = data;
      const { sleepingArrangement } = data[0];
      const babyCrib = JSON.parse(sleepingArrangement.babyCrib);
      const childBed = JSON.parse(sleepingArrangement.childBed);
      const rateData = await DB.select('ratesV2', { unitTypeId: req.body.unitTypeV2Id });
      console.log(rateData);
      const [{
        rateName, currency, price_per_night, checkIn_on_monday,
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
        checkIn_Restriction: [checkIn_on_monday,
          checkIn_on_tuesday, checkIn_on_wednesday, checkIn_on_thursday,
          checkIn_on_friday, checkIn_on_saturday, checkIn_on_sunday],
        checkOut_Restriction: [
          checkOut_on_monday,
          checkOut_on_tuesday,
          checkOut_on_wednesday, checkOut_on_thursday, checkOut_on_friday, checkOut_on_saturday, checkOut_on_sunday],
        minimum_stay: [minimum_stay_on_monday,
          minimum_stay_on_tuesday,
          minimum_stay_on_wednesday,
          minimum_stay_on_thursday, minimum_stay_on_friday, minimum_stay_on_saturday, minimum_stay_on_sunday],
      };
      const groupId = await createGroup(companyName);
      console.log(groupId);
      const propertyId = await createProperty(propertyData, groupId);
      console.log(propertyId);
      const unitTypeId = await createUnitType(propertyId, unitTypeData);
      console.log(unitTypeId);
      const ratePlanId = await createRatePlan(propertyId, unitTypeId, ratesData);
      console.log(ratePlanId);
      // TODO country code should be a code not name
      res.status(200).json({ groupId, propertyId, ratePlanId });
    } catch (e) {
      console.log(e);
    }
  });

  return router;
};
module.exports = channelRouter;
