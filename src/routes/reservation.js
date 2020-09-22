const express = require('express');
const each = require('sync-each');
const moment = require('moment');
const DB = require('../services/database');
const { userAuthCheck } = require('../middlewares/middlewares');
const sentryCapture = require('../../config/sentryCapture');
const { enumerateDaysBetweenDates, getRandomColor } = require('../functions/index');

const reservationRouter = () => {
  const router = express.Router();

  // post api for add reservation
  router.post('/addReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('addReservation', body);
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const reservationData = {
        userId: id,
        unitTypeId: body.property,
        propertyName: body.propertyName,
        bookedUnit: body.unit,
        unitName: body.unitName,
        startDate: body.groupname[0].split('T', 1),
        endDate: body.groupname[1].split('T', 1),
        acknowledge: body.acknowledge,
        channel: body.channel,
        commission: body.commission,
        adult: body.adult,
        guest: body.guest,
        children1: body.children1,
        children2: body.children2,
        notes1: body.notes1,
        notes2: body.notes2,

        perNight: body.perNight,
        night: body.night,
        amt: body.amt,
        discountType: body.discountType,
        discount: body.discount,
        accomodation: body.accomodation,

        noOfservices: body.noOfservices,
        totalAmount: body.totalAmount,
        deposit: body.deposit,
      };

      const Id = await DB.insert('reservationV2', reservationData);
      if (body.guestData[0] !== null) {
        body.guestData.map(async (el) => {
          const Data = {
            userId: id,
            reservationId: Id,
            fullname: el.fullName,
            country: el.country,
            email: el.email,
            phone: el.phone,
          };
          await DB.insert('guestV2', Data);
          await DB.increment(
            'booking',
            {
              id: Id,
            },
            {
              noGuest: 1,
            },
          );
        });
      }

      // body.serviceData.map(async (el) => {
      //   const Data = {
      //     userId: id,
      //     bookingId: Id,
      //     serviceName: el.serviceName,
      //     servicePrice: el.servicePrice,
      //     quantity: el.serviceQuantity,
      //     serviceTax: el.serviceTax,
      //     serviceAmount: el.serviceAmount
      //   };
      //   await DB.insert('bookingService', Data);
      // });

      res.send({
        code: 200,
        msg: 'Reservation save successfully!',
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  // API for get reservation
  router.post('/getReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = [];
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const reservationData = await DB.select('reservationV2', { userId: id });
      each(
        reservationData,
        async (items, next) => {
          const data = await DB.select('guestV2', { reservationId: items.id });
          guestData.push(data);
          next();
        },
        () => {
          res.send({
            code: 200,
            reservationData,
            guestData,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for Reservationb Calendar Data
  router.post('/getReservationCalendarData', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const unitType = await DB.selectCol(['id', 'unitTypeName as name', 'unitsData'], 'unitTypeV2', { userId: id });
      each(
        unitType,
        async (items, next) => {
          const units = [];
          const rates = [];
          const itemsCopy = items;
          const seasonRates = await DB.selectCol(
            ['id', 'unitTypeId', 'startDate', 'endDate', 'price_per_night', 'minimum_stay'],
            'seasonRatesV2',
            {
              unitTypeId: items.id,
            },
          );

          seasonRates.forEach((ele) => {
            const daysBetween = enumerateDaysBetweenDates(moment(new Date(ele.startDate)), moment(new Date(ele.endDate)));
            daysBetween.forEach((el) => {
              const dateInmiliseconds = +new Date(el);
              const ratesData = {
                id: ele.id,
                unitTypeId: ele.unitTypeId,
                date: dateInmiliseconds,
                pricePerNight: ele.price_per_night,
                minStay: ele.minimum_stay,
              };
              rates.push(ratesData);
            });
          });
          const customizeRates = {
            data: rates,
          };
          itemsCopy.rates = customizeRates;
          const reservation = await DB.selectCol(
            ['id', 'startDate', 'endDate', 'totalAmount', 'bookedUnit', 'guest'],
            'reservationV2',
            {
              unitTypeId: items.id,
            },
          );
          if (items.unitsData) {
            JSON.parse(items.unitsData).forEach((ele, i) => {
              const unitsData = {
                id: i,
                name: ele,
                color: getRandomColor(),
              };
              const bookingData = [];
              reservation
                .filter((el) => el.bookedUnit === i)
                .map((data) => {
                  const cutomizeData = {
                    id: data.id,
                    from: +new Date(data.startDate),
                    to: +new Date(data.endDate),
                    guestName: data.guest,
                    price: data.totalAmount,
                  };
                  return bookingData.push(cutomizeData);
                });
              const customizeBooking = {
                data: bookingData,
              };
              unitsData.booking = customizeBooking;
              units.push(unitsData);
            });
          }
          const cutomizeUnits = {
            data: units,
          };
          itemsCopy.units = cutomizeUnits;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            data: unitType,
          });
        },
      );
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  return router;
};

module.exports = reservationRouter;
