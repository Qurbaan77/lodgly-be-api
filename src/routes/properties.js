const express = require('express');
const config = require('config');
const crypto = require('crypto');
const fs = require('fs');
const AWS = require('aws-sdk');
const fileType = require('file-type');
const bluebird = require('bluebird');
const multiparty = require('multiparty');
const DB = require('../services/database');
const { userAuthCheck } = require('../middlewares/middlewares');
const sentryCapture = require('../../config/sentryCapture');

AWS.config.setPromisesDependency(bluebird);

const propertyRouter = () => {
  const router = express.Router();

  // AWS S3 upload function'
  const s3 = new AWS.S3({
    accessKeyId: config.get('aws.accessKey'),
    secretAccessKey: config.get('aws.accessSecretKey'),
  });

  // function for upload image on S3bucket
  const uploadFile = async (buffer, name, type, organizationid) => {
    try {
      console.log('organization id in upload file', organizationid);
      console.log(config.get('aws.accessKey'));
      console.log(config.get('aws.accessSecretKey'));
      console.log(config.get('aws.s3.storageBucketName'));
      const bucket = config.get('aws.s3.storageBucketName');
      const params = {
        ACL: 'public-read',
        Body: buffer,
        Bucket: `${bucket}/${organizationid}/photos`,
        ContentType: type.mime,
        Key: `${name}.${type.ext}`,
      };
      const url = await s3.getSignedUrlPromise('putObject', params);
      return s3.upload(params, url).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
  };

  // post request to add property
  router.post('/addProperty', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log('addProperty', body);
    let id;
    if (body.affiliateId) {
      id = body.affiliateId;
    } else {
      id = body.tokenData.userid;
    }
    const propertyData = {
      userId: id,
      propertyName: body.name,
    };
    const savedData = await DB.insert('propertyV2', propertyData);
    const unitTypeData = {
      userId: id,
      propertyId: savedData,
      unitTypeName: body.name,
    };
    // creating unit type with same name
    const unitTypeV2Id = await DB.insert('unitTypeV2', unitTypeData);
    console.log('unitTypeV2Id', unitTypeV2Id);
    res.send({
      code: 200,
      savedData,
      unitTypeV2Id,
    });
  });

  // post request to delete property
  router.post('/deleteProperty', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    await DB.remove('propertyV2', { id: body.id });
    res.send({
      code: 200,
    });
  });

  // API for fetch property details
  router.post('/fetchProperty', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    let id;
    if (body.affiliateId) {
      id = body.affiliateId;
    } else {
      id = body.tokenData.userid;
    }
    const propertiesData = await DB.select('unitTypeV2', { userId: id });
    res.send({
      code: 200,
      propertiesData,
    });
    // each(
    //   propertiesData,
    //   async (items, next) => {
    //     const itemsCopy = items;
    //     const data = await DB.select('unitTypeV2', { propertyId: items.id });
    //     itemsCopy.unitType = data;
    //     next();
    //     return itemsCopy;
    //   },
    //   () => {
    //     res.send({
    //       code: 200,
    //       propertiesData,
    //     });
    //   },
    // );
  });

  // API for update unittype location
  router.post('/updateLocation', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    const data = {
      address: body.location,
      country: body.country,
      state: body.state,
      city: body.city,
      zip: body.zip,
      lattitude: body.latLng.lat,
      longitude: body.latLng.lng,
      direction: body.direction,
      distance: body.distance,
      distanceIn: body.distanceIn,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    res.send({
      code: 200,
    });
  });

  // API for get unittype location data
  router.post('/fetchUnittypeData', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    const unitTypeV2Data = await DB.select('unitTypeV2', { id: body.unitTypeV2Id });
    res.send({
      code: 200,
      unitTypeV2Data,
    });
  });

  // API for update Unit Type Overview
  router.post('/updateUnitTypeoverview', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    await DB.update('propertyV2', { propertyName: body.propertyName }, { id: body.propertyId });
    const payload = {
      description: body.propertyDescription,
      propertyType: body.propertyType,
    };
    await DB.update('unitTypeV2', payload, { propertyId: body.propertyId });
    res.send({
      code: 200,
    });
  });

  // API for upate Property Information
  router.post('/updatePropertyInfo', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const data = {
      sizeType: body.sqSelectedValue,
      sizeValue: body.sqNumber,
      bedRooms: body.noOfBedRooms,
      standardGuests: body.noOfGuests,
      units: body.noOfUnits,
      unitsData: body.unitsData,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    res.send({
      code: 200,
    });
  });

  // API for update SleepingArrangement
  router.post('/updateSleepingArrangement', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const data = {
      sleepingArrangement: body.sleepingArrangement,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    res.send({
      code: 200,
    });
  });

  // API for fetch SleepingArrangement
  router.post('/updateEditRooms', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const data = {
      rooms: body.rooms,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    res.send({
      code: 200,
    });
  });

  // API for update Amenities
  router.post('/updateAmenities', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    const data = {
      amenities: body.amenities,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    res.send({
      code: 200,
    });
  });

  // API for update property image
  router.post('/propertyPicture', async (req, res) => {
    const form = new multiparty.Form();
    console.log(req.query);
    form.parse(req, async (error, fields, files) => {
      if (error) {
        console.log(error);
      }
      const { path } = files.file[0];
      const buffer = fs.readFileSync(path);
      const type = await fileType.fromBuffer(buffer);
      const timestamp = Date.now().toString();
      const fileName = `bucketFolder/${timestamp}-lg`;
      const hash = crypto.createHash('md5').update(fileName).digest('hex');
      const data = await uploadFile(buffer, hash, type, req.query.organizationid);
      await DB.update('unitTypeV2', { image: data.Location }, { id: req.query.unitTypeV2Id });
      return res.json({
        image: data.Location,
      });
    });
  });

  // API fo add rates on UnitType
  router.post('/addRates', userAuthCheck, async (req, res) => {
    // try {
    // } catch (e) {
    //   sentryCapture(e);
    //   console.log(e);
    //   res.send({
    //     code: 444,
    //     msg: 'some error occured',
    //   });
    // }
    try {
      const { ...body } = req.body;
      const rateData = {
        unitTypeId: body.unitTypeId,
        rateName: body.rateName,
        currency: body.currency,
        price_per_night: body.pricePerNight,
        minimum_stay: body.minStay,
        discount_price_per_week: body.weeklyPrice,
        discount_price_per_month: body.monthlyPrice,
        discount_price_custom_nights: body.customNightsPrice,
        price_on_monday: body.priceOnMon,
        price_on_tuesday: body.priceOnTues,
        price_on_wednesday: body.priceOnWed,
        price_on_thursday: body.priceOnThu,
        price_on_friday: body.priceOnFri,
        price_on_saturday: body.priceOnSat,
        price_on_sunday: body.priceOnSun,
        minimum_stay_on_monday: body.minStayOnMon,
        minimum_stay_on_tuesday: body.minStayOnTues,
        minimum_stay_on_wednesday: body.minStayOnWed,
        minimum_stay_on_thursday: body.minStayOnThu,
        minimum_stay_on_friday: body.minStayOnFri,
        minimum_stay_on_saturday: body.minStayOnSat,
        minimum_stay_on_sunday: body.minStayOnSun,
        extra_charge_on_guest: body.extraCharge,
        extra_guest: body.extraGuest,
        short_stay: body.shortStayNight,
        extra_chage_on_stay: body.shortStayPrice,
        checkIn_on_monday: body.checkIn_on_monday,
        checkIn_on_tuesday: body.checkIn_on_tuesday,
        checkIn_on_wednesday: body.checkIn_on_wednesday,
        checkIn_on_thursday: body.checkIn_on_thursday,
        checkIn_on_friday: body.checkIn_on_friday,
        checkIn_on_saturday: body.checkIn_on_saturday,
        checkIn_on_sunday: body.checkIn_on_sunday,
        checkOut_on_monday: body.checkOut_on_monday,
        checkOut_on_tuesday: body.checkOut_on_tuesday,
        checkOut_on_wednesday: body.checkOut_on_wednesday,
        checkOut_on_thursday: body.checkOut_on_thursday,
        checkOut_on_friday: body.checkOut_on_friday,
        checkOut_on_saturday: body.checkOut_on_saturday,
        checkOut_on_sunday: body.checkOut_on_sunday,
        tax_status: body.tax,
        tax: body.taxPer,
        notes: body.notes,
      };
      await DB.insert('ratesV2', rateData);
      res.send({
        code: 200,
        msg: 'Data save successfully!',
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for add rates for unitType
  router.post('/getRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const ratesData = await DB.select('ratesV2', { unitTypeId: body.unittypeId });
    const seasonRatesData = await DB.select('seasonRatesV2', { unitTypeId: body.unittypeId });
    console.log(ratesData);
    console.log(seasonRatesData);
    res.send({
      code: 200,
      ratesData,
      seasonRatesData,
    });
  });

  // API for add seasonRates
  router.post('/addSeasonRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    let startDateTime;
    let endDateTime;
    if (body.groupname) {
      startDateTime = new Date(body.groupname[0]);
      endDateTime = new Date(body.groupname[1]);
    }

    const seasonRateData = {
      unitTypeId: body.unitTypeId,
      seasonRateName: body.seasonRateName,
      startDate: startDateTime,
      endDate: endDateTime,
      price_per_night: body.pricePerNight,
      minimum_stay: body.minStay,
      discount_price_per_week: body.weeklyPrice,
      discount_price_per_month: body.monthlyPrice,
      discount_price_custom_nights: body.customNightsPrice,
      price_on_monday: body.priceOnMon,
      price_on_tuesday: body.priceOnTues,
      price_on_wednesday: body.priceOnWed,
      price_on_thursday: body.priceOnThu,
      price_on_friday: body.priceOnFri,
      price_on_saturday: body.priceOnSat,
      price_on_sunday: body.priceOnSun,
      minimum_stay_on_monday: body.minStayOnMon,
      minimum_stay_on_tuesday: body.minStayOnTues,
      minimum_stay_on_wednesday: body.minStayOnWed,
      minimum_stay_on_thursday: body.minStayOnThu,
      minimum_stay_on_friday: body.minStayOnFri,
      minimum_stay_on_saturday: body.minStayOnSat,
      minimum_stay_on_sunday: body.minStayOnSun,
      extra_charge_on_guest: body.extraCharge,
      extra_guest: body.extraGuest,
      short_stay: body.shortStayNight,
      extra_chage_on_stay: body.shortStayPrice,
      checkIn_on_monday: body.checkIn_on_monday,
      checkIn_on_tuesday: body.checkIn_on_tuesday,
      checkIn_on_wednesday: body.checkIn_on_wednesday,
      checkIn_on_thursday: body.checkIn_on_thursday,
      checkIn_on_friday: body.checkIn_on_friday,
      checkIn_on_saturday: body.checkIn_on_saturday,
      checkIn_on_sunday: body.checkIn_on_sunday,
      checkOut_on_monday: body.checkOut_on_monday,
      checkOut_on_tuesday: body.checkOut_on_tuesday,
      checkOut_on_wednesday: body.checkOut_on_wednesday,
      checkOut_on_thursday: body.checkOut_on_thursday,
      checkOut_on_friday: body.checkOut_on_friday,
      checkOut_on_saturday: body.checkOut_on_saturday,
      checkOut_on_sunday: body.checkOut_on_sunday,
    };
    if (body.id) {
      await DB.update('seasonRatesV2', seasonRateData, { id: body.id });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
      });
    } else {
      await DB.insert('seasonRatesV2', seasonRateData);
      res.send({
        code: 200,
        msg: 'Data save successfully!',
      });
    }
  });

  // API for get Season Rates
  router.post('/getSeasonRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log('getSeasonRates', body);
    const seasonRateData = await DB.select('seasonRatesV2', { unitTypeId: body.unitTypeId });
    res.send({
      code: 200,
      seasonRateData,
    });
  });

  // API for delete seasonRate
  router.post('/deleteSeasonRate', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    await DB.remove('seasonRatesV2', { id: body.id });
    res.send({
      code: 200,
      msg: 'SeasonRate delete successfully!',
    });
  });

  // get seasonRatesData for an individual
  router.get('/getSeasonRate/:id', userAuthCheck, async (req, res) => {
    const seasonRateId = req.params.id;
    const seasonRateData = await DB.select('seasonRatesV2', { id: seasonRateId });
    res.send({
      code: 200,
      seasonRateData,
    });
  });

  // api for copy rates of unitType
  router.post('/copyRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const rateData = {
      unitTypeId: body.newUnitType,
      rateName: body.rateName,
      currency: body.currency,
      price_per_night: body.price_per_night,
      minimum_stay: body.minimum_stay,
      discount_price_per_week: body.discount_price_per_week,
      discount_price_per_month: body.discount_price_per_month,
      discount_price_custom_nights: body.discount_price_custom_nights,
      price_on_monday: body.price_on_monday,
      price_on_tuesday: body.price_on_tuesday,
      price_on_wednesday: body.price_on_wednesday,
      price_on_thursday: body.price_on_thursday,
      price_on_friday: body.price_on_friday,
      price_on_saturday: body.price_on_saturday,
      price_on_sunday: body.price_on_sunday,
      minimum_stay_on_monday: body.minimum_stay_on_monday,
      minimum_stay_on_tuesday: body.minimum_stay_on_tuesday,
      minimum_stay_on_wednesday: body.minimum_stay_on_wednesday,
      minimum_stay_on_thursday: body.minimum_stay_on_thursday,
      minimum_stay_on_friday: body.minimum_stay_on_friday,
      minimum_stay_on_saturday: body.minimum_stay_on_saturday,
      minimum_stay_on_sunday: body.minimum_stay_on_sunday,
      extra_charge_on_guest: body.extra_charge_on_guest,
      extra_guest: body.extra_guest,
      short_stay: body.short_stay,
      extra_chage_on_stay: body.extra_chage_on_stay,
      checkIn_on_monday: body.checkIn_on_monday,
      checkIn_on_tuesday: body.checkIn_on_tuesday,
      checkIn_on_wednesday: body.checkIn_on_wednesday,
      checkIn_on_thursday: body.checkIn_on_thursday,
      checkIn_on_friday: body.checkIn_on_friday,
      checkIn_on_saturday: body.checkIn_on_saturday,
      checkIn_on_sunday: body.checkIn_on_sunday,
      checkOut_on_monday: body.checkOut_on_monday,
      checkOut_on_tuesday: body.checkOut_on_tuesday,
      checkOut_on_wednesday: body.checkOut_on_wednesday,
      checkOut_on_thursday: body.checkOut_on_thursday,
      checkOut_on_friday: body.checkOut_on_friday,
      checkOut_on_saturday: body.checkOut_on_saturday,
      checkOut_on_sunday: body.checkOut_on_sunday,
      tax_status: body.tax_status,
      tax: body.tax,
      notes: body.notes,
    };
    await DB.insert('ratesV2', rateData);
    res.send({
      code: 200,
      msg: 'Data save successfully!',
    });
  });

  // API forlisting in copyRates
  router.post('/getUnitTypeRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    const unittypeData = await DB.select('unitTypeV2', { userId: body.tokenData.userid });
    res.send({
      code: 200,
      unittypeData,
    });
  });

  // API for getting individual property details
  router.post('/getProperty', userAuthCheck, async (req, res) => {
    console.log(req.body);
    const propertyData = await DB.selectCol(['unitTypeName', 'image'], 'unitTypeV2', { id: req.body.propertyId });
    if (propertyData) {
      res.send({
        code: 200,
        propertyData,
      });
    } else {
      res.send({
        code: 404,
        msg: 'Property Does not exist',
      });
    }
  });

  // API for removing property photo
  router.post('/removePropertyPhoto', userAuthCheck, async (req, res) => {
    try {
      console.log(req.body);
      await DB.update('unitTypeV2', { image: null }, { id: req.body.unitTypeV2Id });
      res.send({
        code: 200,
        msg: 'successfully removed property photo',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'server error',
      });
    }
  });

  return router;
};

module.exports = propertyRouter;
