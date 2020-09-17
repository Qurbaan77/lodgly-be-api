const express = require('express');
const config = require('config');
// const convert = require('xml-js');
// const DB = require('../services/database');
// const { userAuthCheck } = require('../middlewares/middlewares');
const { setCredentials } = require('../rentalsUnitedIntegration/authentication');
// const { createBuilding } = require('../rentalsUnitedIntegration/API');

const channelRouter = () => {
  const router = express.Router();
  const user = config.get('RU_USER');
  const password = config.get('RU_PASSWORD');
  setCredentials(user, password);

  // steps to push property to RU
  // 1- create Building(it will return building id)(pass it in PUID's Building Id)
  // 2- create owner(it will return owner id)(pass it in owner id)
  // 3- Hit "getLocationByCoordinates" by passing coordinates and get location id from it
  // 4- Hit "getLocationDetails" by passing location Id from step 3
  // 5- get "LocationTypeID" from previous step from the object which has location ID which we had in step 3
  // 6- calculate space in sqm and pass it to space
  // 7- according to beedrooms selected pass propertyTypeID

  // pushing property to rentals united starts here
  // router.post('/pushProperty', userAuthCheck, async (req, res) => {
  //   try {
  //     const unitTypeData = await DB.select('unitTypeV2', { id: req.body.unitTypeV2Id });
  //     const [{
  //       id,
  //       unitTypeName,
  //       description,
  //       sizeType,
  //       sizeValue,
  //       standardGuests,
  //       units,
  //       propertyType,
  //       lattitude,
  //       longitude,
  //       image,
  //     }] = unitTypeData;
  //     // creating owner in RU

  //   } catch (e) {
  //     console.log(e);
  //     res.send({
  //       code: 444,
  //       msg: 'some error occured!',
  //     });
  //   }
  // });

  // API to get available room amenities
  // router.get('/getAmenities', async (req, res) => {
  //   const response = await getAmenities();
  //   const responsejson = convert.xml2json(response.data, { compact: true, spaces: 4 });
  //   console.log(responsejson);
  //   res.send({
  //     responsejson,
  //   });
  // });
  return router;
};
module.exports = channelRouter;
