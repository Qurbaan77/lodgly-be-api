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
  router.post('/pushProperty', async (req, res) => {
    token = await auth(user, password);
    console.log(token);
    const data = await DB.select('unitTypeV2', { id: req.body.unitTypeV2Id });
    const [{
      unitTypeName, description, country, state, city, zip,
      lattitude, longitude, image, address,
    }] = data;
    const propertyData = {
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
    const groupId = await createGroup(unitTypeName);
    console.log(groupId);
    const propertyId = await createProperty(propertyData, groupId);
    console.log(propertyId);
    res.status(200).json({ groupId, propertyId });
  });

  return router;
};
module.exports = channelRouter;
