const express = require('express');
const config = require('config');
const each = require('sync-each');
// const crypto = require('crypto');
// const fs = require('fs');
const AWS = require('aws-sdk');
// const fileType = require('file-type');
const bluebird = require('bluebird');
// const each = require('sync-each');
// const multiparty = require('multiparty');
const moment = require('moment');
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
    signatureVersion: 'v4',
  });
  const bucket = config.get('aws.s3.storageBucketName');

  // const getSignedUrl = (name, size, type, organizationid) => new Promise((resolve, reject) => {
  //   console.log(organizationid);
  //   if (!name) return resolve(null);
  //   return s3.getSignedUrl('putObject', {
  //     Key: name,
  //     Bucket: `${bucket}/${organizationid}/photos`,
  //     ContentType: type,
  //     Expires: 300,
  //   }, (error, result) => (error ? reject(error) : resolve(result)));
  // });

  // function for upload image on S3bucket
  const uploadFile = async (name, type, organizationid, expires = 300) => {
    try {
      // const bucket = config.get('aws.s3.storageBucketName');
      const params = {
        ACL: 'public-read',
        // Body: buffer,
        Bucket: `${bucket}/${organizationid}/photos`,
        ContentType: type,
        Key: name,
        Expires: expires,
      };
      const url = await s3.getSignedUrlPromise('putObject', params);
      return url;
      // return s3.upload(params, url).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
  };

  // post request to add property
  router.post('/addProperty', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
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
    const data = await DB.select('propertyV2', { propertyName: body.name, userId: body.tokenData.userid });
    if (data && data.length > 0) {
      res.send({
        code: 440,
        msg: 'This property already exist',
      });
    } else {
      const savedData = await DB.insert('propertyV2', propertyData);
      const jsonName = JSON.stringify([{ lang: 'en', name: body.name }]);
      const langJson = JSON.stringify([{ en: 'English' }]);
      const descriptionJson = JSON.stringify([]);
      const unitTypeData = {
        userId: id,
        propertyId: savedData,
        unitTypeName: jsonName,
        languages: langJson,
        description: descriptionJson,
      };
      // creating unit type with same name
      const unitTypeV2Id = await DB.insert('unitTypeV2', unitTypeData);
      res.send({
        code: 200,
        savedData,
        unitTypeV2Id,
      });
    }
  });

  // post request to delete property
  router.post('/deleteProperty', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    await DB.remove('propertyV2', { id: body.id });
    await DB.remove('unitTypeV2', { id: body.id });
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
    const data = await DB.select('unitTypeV2', { userId: id });
    const propertiesData = data;
    // res.send({
    //   code: 200,
    //   propertiesData,
    // });
    each(
      propertiesData,
      async (items, next) => {
        const itemsCopy = items;
        const unitDataV2 = await DB.select('unitV2', { unittypeId: items.id });
        itemsCopy.unitDataV2 = unitDataV2;
        const rate = await DB.select('ratesV2', { unitTypeId: itemsCopy.id });
        const data1 = await DB.selectCol(['url'], 'images', { unitTypeId: items.id });
        itemsCopy.image = data1 && data1.length && data1[0].url;
        if (!rate) {
          itemsCopy.isCompleted = false;
        }
        if (!unitDataV2) {
          itemsCopy.isCompleted = false;
        }
        Object.keys(itemsCopy).forEach((key) => {
          if (!items[key]) {
            if (key !== 'ownerId' && key !== 'isChannelManagerActivated' && key !== 'airbnb' && key !== 'booking'
            && key !== 'expedia' && key !== 'unitsData' && key !== 'direction' && key !== 'website'
            && key !== 'customAddress' && key !== 'country' && key !== 'state' && key !== 'city' && key !== 'zip') {
              itemsCopy.isCompleted = false;
            }
          }
        });
        if (itemsCopy.isCompleted === undefined) {
          itemsCopy.isCompleted = true;
        }
        next();
        return itemsCopy;
      },
      () => {
        res.send({
          code: 200,
          propertiesData,
        });
      },
    );
  });

  // Get info for completeness of property
  router.post('/getPropertyCompleteness', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const data = await DB.select('unitTypeV2', { id: body.unitTypeV2Id });
      console.log('data coming from sidenav', data);
      let addressCompleted = true;
      let imageCompleted = true;
      let ratesCompleted = true;
      let OverviewCompleted = true;
      if (data && data.length > 0) {
        const ratesData = await DB.select('ratesV2', { unitTypeId: body.unitTypeV2Id });
        if (ratesData && ratesData.length > 0) {
          console.log('a');
        } else {
          console.log('b');
          ratesCompleted = false;
        }
        data.forEach(async (el) => {
          // const copyel = el;
          Object.keys(el).forEach((key) => {
            if (!el[key]) {
              if (key === 'image') {
                imageCompleted = false;
              } else if (key === 'address') {
                addressCompleted = false;
              } else if (key === 'sizeType' || key === 'bedRooms' || key === 'standardGuests'
              || key === 'units' || key === 'propertyType' || key === 'amenities' || key === 'rooms'
              || key === 'sleepingArrangement') {
                OverviewCompleted = false;
              }
            }
          });
        });
        res.send({
          code: 200,
          addressCompleted,
          imageCompleted,
          ratesCompleted,
          OverviewCompleted,
        });
      } else {
        res.send({
          code: 404,
          msg: 'no data found',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occurred!',
      });
    }
  });

  router.get('/getPropertyName', userAuthCheck, async (req, res) => {
    try {
      const propertyData = await DB.select('propertyV2', { userId: req.body.tokenData.userid });
      if (propertyData && propertyData.length > 0) {
        res.send({
          code: 200,
          propertyData,
        });
      } else {
        res.send({
          code: 404,
          msg: 'No properties created',
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // Get unit type name and id only
  router.get('/getPropDetail', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      const payload = await DB.selectCol(['id', 'unitTypeName', 'ownerId'],
        'unitTypeV2', { userId: body.tokenData.userid });
      const data = [];
      each(
        payload,
        (item, next) => {
          const obj = {};
          obj.id = item.id;
          obj.ownerId = item.ownerId;
          const [label] = item.unitTypeName
            .filter((e) => e.lang === 'en')
            .map((name) => name.name);
          obj.name = label;
          data.push(obj);
          next();
        },
        () => {
          res.send({
            code: 200,
            data,
          });
        },
      );
    } catch (e) {
      console.log(e);
    }
  });

  // API for update unittype location
  router.post('/updateLocation', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const directionToSave = { lang: body.direction.lang, direction: body.direction.directionText };
    let newDirection = [];
    const responseData = await DB.selectCol(['direction'], 'unitTypeV2', {
      id: body.unitTypeV2Id,
    });
    if (responseData && responseData[0].direction !== null) {
      newDirection = responseData[0].direction.filter((el) => el.lang !== body.direction.lang);
    }
    newDirection.push(directionToSave);
    const data = {
      address: JSON.stringify(body.location),
      country: JSON.stringify(body.country),
      state: JSON.stringify(body.state),
      city: JSON.stringify(body.city),
      zip: body.zip,
      lattitude: body.latLng.lat,
      longitude: body.latLng.lng,
      direction: JSON.stringify(newDirection),
      distance: body.distance,
      distanceIn: body.distanceIn,
      customAddress: body.customAddress,
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
    const unitV2Data = await DB.select('unitV2', { unittypeId: body.unitTypeV2Id });
    const newDataArray = [];
    unitTypeV2Data.forEach((unitTypeV2) => {
      const copyValues = unitTypeV2;
      copyValues.arrayOfUnits = unitTypeV2.unitsData;
      copyValues.unitV2Data = unitV2Data;
      newDataArray.push(copyValues);
    });
    res.send({
      code: 200,
      unitTypeV2Data: newDataArray,
    });
  });

  // API for update Unit Type Overview
  router.post('/updateUnitTypeoverview', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    const language = body.languageSelected ? body.languageSelected : 'en';
    const descriptionToSave = { lang: language, description: body.propertyDescription };
    const nameToSave = { lang: language, name: body.propertyName };
    let newPropertyDesciption = [];
    let newPropertyName = [];
    await DB.update('propertyV2', { propertyName: body.propertyName }, { id: body.propertyId });

    const responseData = await DB.selectCol(['description', 'unitTypeName'], 'unitTypeV2', {
      propertyId: body.propertyId,
    });

    newPropertyDesciption = responseData[0].description.filter((el) => el.lang !== language);
    newPropertyName = responseData[0].unitTypeName.filter((el) => el.lang !== language);
    newPropertyDesciption.push(descriptionToSave);
    newPropertyName.push(nameToSave);
    const savePayload = {
      description: JSON.stringify(newPropertyDesciption),
      unitTypeName: JSON.stringify(newPropertyName),
      // propertyType: body.propertyType,
    };
    const updateResponse = await DB.update('unitTypeV2', savePayload, { propertyId: body.propertyId });
    if (updateResponse) {
      res.send({
        code: 200,
      });
    }
  });

  // API for saving rental type
  router.post('/changeRentalType', userAuthCheck, async (req, res) => {
    try {
      await DB.update('unitTypeV2', { propertyType: req.body.propertyType }, { id: req.body.propertyId });
      res.send({
        code: 200,
        msg: 'successfully saved property type',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // API for upate Property Information
  router.post('/updatePropertyInfo', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log('body', body);
    if (body.deletedUnitArray && body.deletedUnitArray.length) {
      body.deletedUnitArray.forEach(async (el) => {
        await DB.remove('unitV2', { id: el });
      });
    }
    const data = {
      sizeType: body.sqSelectedValue,
      sizeValue: body.sqNumber,
      bedRooms: body.noOfBedRooms,
      standardGuests: body.noOfGuests,
      units: body.noOfUnits,
      // unitsData: body.unitsData,
    };
    await DB.update('unitTypeV2', data, { id: body.unitTypeV2Id });
    each(
      // JSON.parse(body.unitsData),
      body.unitsData,
      async (items, next) => {
        const unitData = {
          userId: body.tokenData.userid,
          unittypeId: body.unitTypeV2Id,
          unitName: items.unitName,
        };
        if (items.id) {
          await DB.update('unitV2', { unitName: items.unitName }, { id: items.id });
        } else {
          await DB.insert('unitV2', unitData);
        }
        next();
      },
      () => {
        res.send({
          code: 200,
        });
      },
    );
  });

  // API for update SleepingArrangement
  router.post('/updateSleepingArrangement', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
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

  // API to get presigned url for photo upload
  router.post('/getPreSignedUrl', userAuthCheck, async (req, res) => {
    console.log(req.query.organizationid);
    try {
      const { body } = req;
      const { name, type } = body;
      console.log('request coming');
      // const timestamp = Date.now().toString();
      // const fileName = `bucketFolder/${timestamp}-lg`;
      // const hash = crypto.createHash('md5').update(fileName).digest('hex');
      const presignedUrl = await uploadFile(name, type, req.query.organizationid);
      // const presignedUrl = await getSignedUrl(hash, type, req.query.organizationid);
      // console.log('presigned url', presignedUrl);
      res.send({
        code: 200,
        presignedUrl,
      });
    } catch (e) {
      console.log(e);
    }
  });

  // get property images
  router.post('/propertyImages', userAuthCheck, async ({ body }, res) => {
    try {
      const images = await DB.selectCol(['url', 'id'], 'images', { unitTypeId: body.unitTypeV2Id });
      if (images && images.length > 0) {
        res.send({
          code: 200,
          images,
        });
      } else {
        res.send({
          code: 404,
          msg: 'no images for this property',
        });
      }
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'some error occurred!',
      });
    }
  });

  // API for update property image
  router.post('/insertPropertyImage', userAuthCheck, async (req, res) => {
    console.log('api hitting', req.body);
    try {
      const { propertyurl, unitTypeV2Id } = req.body;
      await DB.insert('images', { url: propertyurl, unitTypeId: unitTypeV2Id });
      res.send({
        code: 200,
        msg: 'photo saved successfully',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error ocured',
      });
    }
  });

  // API for update property image
  router.post('/updatePropertyImage', userAuthCheck, async (req, res) => {
    try {
      const { urls, unitTypeV2Id } = req.body;
      each(
        urls,
        async (url, next) => {
          await DB.insert('images', { url, unitTypeId: unitTypeV2Id });
          next();
        },
        () => {
          res.send({
            code: 200,
            msg: 'updated property image',
          });
        },
      );
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error ocured',
      });
    }
  });

  router.post('/updateUserPic', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      await DB.update('users', { image: body.url }, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'successfully updated image',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API fo add rates on UnitType
  router.post('/addRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const notesToSave = { lang: body.notes.lang, note: body.notes.note };
      let newNotes = [];
      const responseData = await DB.selectCol(['notes'], 'ratesV2', { unitTypeId: body.unitTypeId });
      if (responseData && responseData.length > 0) {
        newNotes = responseData[0].notes.filter((el) => el.lang !== body.notes.lang);
      }
      newNotes.push(notesToSave);
      const data = await DB.select('ratesV2', { unitTypeId: body.unitTypeId });
      const rateData = {
        unitTypeId: body.unitTypeId,
        rateName: body.rateName,
        currency: body.currency,
        currencyCode: body.currencyCode,
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
        notes: JSON.stringify(newNotes),
      };
      if (data.length > 0) {
        console.log(data[0].id);
        await DB.update('ratesV2', rateData, { id: data[0].id });
        await DB.update('unitTypeV2', { currency: body.currency }, { id: body.unitTypeId });
        /**
         * TODO check if channl manager is activated if yes then push this update to channex
         */
        // const channelactivate = await DB.selectCol(['isChannelManagerActivated'],
        // 'unitTypeV2', { id: body.unitTypeId });
        // const [{ isChannelManagerActivated }] = channelactivate;
        // if (isChannelManagerActivated) {
        // }
      } else {
        await DB.insert('ratesV2', rateData);
        await DB.update('unitTypeV2', { currency: body.currency }, { id: body.unitTypeId });
      }
      // if (body.id > 0) {
      //   await DB.update('ratesV2', rateData, { id: body.id });
      // } else {
      //   await DB.insert('ratesV2', rateData);
      // }
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
    const ratesData = await DB.select('ratesV2', { unitTypeId: body.unittypeId });
    const seasonRatesData = await DB.select('seasonRatesV2', { unitTypeId: body.unittypeId });
    res.send({
      code: 200,
      ratesData,
      seasonRatesData,
    });
  });

  // API for add seasonRates
  router.post('/addSeasonRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    let startDateTime;
    let endDateTime;
    if (body.groupname) {
      startDateTime = new Date(body.groupname[0]);
      endDateTime = new Date(body.groupname[1]);
    }

    const seasonRateData = {
      unitTypeId: body.unitTypeId,
      seasonRateName: body.seasonRateName,
      currency: body.currency,
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
      const savedId = await DB.insert('seasonRatesV2', seasonRateData);
      res.send({
        code: 200,
        savedId,
      });
    }
  });

  // API for get Season Rates
  router.post('/getSeasonRates', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
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
    const propertyData = await DB.selectCol(['unitTypeName'], 'unitTypeV2', {
      propertyId: req.body.propertyId,
    });
    const name = propertyData[0].unitTypeName.filter((el) => el.lang === 'en');
    const imageData = await DB.selectCol(['url'], 'images', { unitTypeId: req.body.propertyId });
    const image = imageData && imageData.length && imageData[0].url;
    if (propertyData) {
      res.send({
        code: 200,
        image,
        name,
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
      await DB.remove('images', { id: req.body.id });
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

  router.post('/addLanguage', async (req, res) => {
    try {
      const { ...body } = req.body;
      let newLanguage = [];
      const languageData = await DB.selectCol(['languages'], 'unitTypeV2', { propertyId: body.propertyId });
      newLanguage = languageData[0].languages;
      newLanguage.push(body.language);
      newLanguage = Array.from(new Set(newLanguage.map(JSON.stringify))).map(JSON.parse);
      const savedData = await DB.update(
        'unitTypeV2',
        { languages: JSON.stringify(newLanguage) },
        { propertyId: body.propertyId },
      );
      if (savedData) {
        res.status(200).send({
          msg: 'Languages Saved',
        });
      } else {
        res.status(201).send({
          msg: 'Error Saving Languages',
        });
      }
    } catch (error) {
      console.log('Error:::', error.message);
    }
  });

  router.post('/removeLanguage', async (req, res) => {
    try {
      const { ...body } = req.body;
      const { filterLang } = req.body;
      let newLanguage = [];
      let filteredArray = [];
      const languageData = await DB.selectCol(['languages'], 'unitTypeV2', { propertyId: body.propertyId });
      newLanguage = languageData[0].languages;
      filteredArray = newLanguage.filter((el) => Object.keys(el)[0] !== filterLang);
      filteredArray = Array.from(new Set(filteredArray.map(JSON.stringify))).map(JSON.parse);
      const savedData = await DB.update(
        'unitTypeV2',
        { languages: JSON.stringify(filteredArray) },
        { propertyId: body.propertyId },
      );
      if (savedData) {
        res.status(200).send({
          msg: 'Languages Removed',
        });
      } else {
        res.status(201).send({
          msg: 'Error Removing Languages',
        });
      }
    } catch (error) {
      console.log('Error', error.message);
    }
  });

  router.get('/languages/:propertyId', async (req, res) => {
    try {
      const languageData = await DB.selectCol(['languages'], 'unitTypeV2', { propertyId: req.params.propertyId });
      if (languageData) {
        res.status(200).send({
          language: languageData[0].languages,
          msg: 'List of Languages',
        });
      } else {
        res.status(201).send({
          msg: 'Error',
        });
      }
    } catch (error) {
      console.log('Error', error.message);
      res.status(400).send({
        msg: 'Internal Server Error',
      });
    }
  });

  // save rate's notes translation
  router.post('/saveNotesTranslation', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      let newNotes = [];
      const responseData = await DB.selectCol(['notes'], 'ratesV2', {
        unitTypeId: body.propertyId,
      });
      console.log(responseData);
      if (responseData && responseData.length && responseData[0].notes !== null) {
        newNotes = responseData[0].notes.filter((el) => el.lang !== body.notesObject.lang);
      }
      newNotes.push(body.directionObject);
      const savePayload = {
        notes: JSON.stringify(newNotes),
      };
      console.log(savePayload);
      const saveResponse = await DB.update('ratesV2', savePayload, { unitTypeId: body.propertyId });
      console.log(saveResponse);
      if (saveResponse) {
        res.send({
          code: 200,
          directionText: body.notesObject,
        });
      } else {
        res.send({
          code: 402,
          msg: 'Error Saving Translation',
        });
      }
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // save direction translation
  router.post('/saveDirectionTranslation', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      let directionText = [];
      const responseData = await DB.selectCol(['direction'], 'unitTypeV2', {
        propertyId: body.propertyId,
      });
      console.log(responseData);
      if (responseData && responseData[0].direction !== null) {
        directionText = responseData[0].direction.filter((el) => el.lang !== body.directionObject.lang);
      }
      directionText.push(body.directionObject);
      const savePayload = {
        direction: JSON.stringify(directionText),
      };
      const saveResponse = await DB.update('unitTypeV2', savePayload, { propertyId: body.propertyId });
      if (saveResponse) {
        res.send({
          code: 200,
          directionText: body.directionObject,
        });
      } else {
        res.send({
          code: 402,
          msg: 'Error Saving Translation',
        });
      }
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // fetch translated rate's note text
  router.get('/fetchTranslatedNotes/:lang/:propertyId', async (req, res) => {
    try {
      const { lang, propertyId } = req.params;
      console.log(req.params);
      let filteredNotes = [];
      const responseData = await DB.selectCol(['notes'], 'ratesV2', {
        unitTypeId: propertyId,
      });
      if (responseData.length > 0) {
        if (responseData[0].notes !== null) {
          filteredNotes = responseData[0].notes.filter((el) => el.lang === lang);
        }
      }
      if (filteredNotes && filteredNotes.length > 0) {
        res.send({
          code: 200,
          filteredNotes,
        });
      } else {
        res.send({
          code: 404,
          msg: 'no notes for the chosen language',
        });
      }
    } catch (error) {
      console.log('Error', error);
    }
  });

  // fetch translated direction text
  router.get('/fetchTranslatedDirection/:lang/:propertyId', async (req, res) => {
    try {
      const { lang, propertyId } = req.params;
      let filteredDirection = [];
      const responseData = await DB.selectCol(['direction'], 'unitTypeV2', {
        propertyId,
      });
      if (responseData && responseData[0].direction !== null) {
        filteredDirection = responseData[0].direction.filter((el) => el.lang === lang);
      }
      if (filteredDirection && filteredDirection.length > 0) {
        res.send({
          code: 200,
          filteredDirection,
        });
      } else {
        res.send({
          code: 404,
          msg: 'no direction for the chosen language',
        });
      }
    } catch (error) {
      console.log('Error', error);
    }
  });

  router.post('/saveTranslation', async (req, res) => {
    try {
      const { ...body } = req.body;
      let newPropertyName = [];
      let newPropertyDesciption = [];
      const responseData = await DB.selectCol(['unitTypeName', 'description'], 'unitTypeV2', {
        propertyId: body.propertyId,
      });

      newPropertyName = responseData[0].unitTypeName.filter((el) => el.lang !== body.nameObject.lang);
      newPropertyDesciption = responseData[0].description.filter((el) => el.lang !== body.descriptionObject.lang);
      newPropertyName.push(body.nameObject);
      newPropertyDesciption.push(body.descriptionObject);
      const savePayload = {
        unitTypeName: JSON.stringify(newPropertyName),
        description: JSON.stringify(newPropertyDesciption),
      };
      const saveResponse = await DB.update('unitTypeV2', savePayload, { propertyId: body.propertyId });
      if (saveResponse) {
        res.status(200).send({
          msg: 'Translation Saved',
          pName: body.nameObject,
          pDescription: body.descriptionObject,
        });
      } else {
        res.status(202).send({
          msg: 'Error Saving Translation',
        });
      }
    } catch (error) {
      console.log('Error', error.message);
    }
  });

  router.get('/fetchTranslated/:lang/:propertyId', async (req, res) => {
    try {
      const { lang, propertyId } = req.params;
      let filteredName = [];
      let filteredDescription = [];
      const responseData = await DB.selectCol(['unitTypeName', 'description'], 'unitTypeV2', {
        propertyId,
      });
      filteredName = responseData[0].unitTypeName.filter((el) => el.lang === lang);
      filteredDescription = responseData[0].description.filter((el) => el.lang === lang);

      if (filteredDescription && filteredName) {
        res.status(200).send({
          filteredName,
          filteredDescription,
        });
      }
    } catch (error) {
      console.log('Error', error);
    }
  });
  // API for fetch unittype
  router.post('/getUnittype', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unittypeData = await DB.select('unitTypeV2', { propertyId: body.propertyId });
      each(
        unittypeData,
        async (items, next) => {
          const itemsCopy = items;
          const unitDataV2 = await DB.select('unitV2', { unittypeId: items.id });
          itemsCopy.unitDataV2 = unitDataV2;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            unittypeData,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for add CustomRates of Property
  router.post('/addCustomRate', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      let startDateTime;
      let endDateTime;
      if (body.groupname) {
        startDateTime = new Date(body.groupname[0]);
        endDateTime = moment(new Date(body.groupname[0])).add(1, 'd').format('YYYY-MM-DD');
      }
      const customRateData = {
        unitTypeId: body.unitTypeId,
        startDate: startDateTime,
        endDate: endDateTime,
        rateType: body.rateType,
        price_per_night: body.rate,
        minimum_stay: body.stay,
      };
      console.log('customRateDate', customRateData);
      await DB.insert('customRate', customRateData);
      res.send({
        code: 200,
      });
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });
  // API for getting minimum stay from rates table
  router.post('/getMinStay', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      console.log(body);
      const data = await DB.selectCol(['minimum_stay'], 'ratesV2', { unitTypeId: body.unitTypeV2Id });
      if (data && data.length > 0) {
        const [{ minimum_stay: minimumStay }] = data;
        res.send({
          code: 200,
          minimumStay,
        });
      } else {
        res.send({
          code: 404,
          msg: 'rates not set yet',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // API for getting units left of the user
  router.get('/getUnitsLeft', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      const totalUnitsData = await DB.select('unitV2', { userId: body.tokenData.userid });
      const subscribedUnitData = await DB.selectCol(['units'], 'subscription', { userId: body.tokenData.userid });
      if (subscribedUnitData && subscribedUnitData.length > 0) {
        const [{ units }] = subscribedUnitData;
        const createdUnits = totalUnitsData.length;
        const leftUnits = units - createdUnits;
        res.send({
          code: 200,
          leftUnits,
        });
      } else {
        // user is on trial
        res.send({
          code: 205,
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });
  return router;
};

module.exports = propertyRouter;
