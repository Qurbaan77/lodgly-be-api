const express = require('express');
const each = require('sync-each');
const moment = require('moment');
const DB = require('../services/database');
const { userAuthCheck } = require('../middlewares/middlewares');
const sentryCapture = require('../../config/sentryCapture');
const { enumerateDaysBetweenDates } = require('../functions/index');

const reservationRouter = () => {
  const router = express.Router();

  // post api for add reservation
  router.post('/addReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      console.log('Body', body);
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

      if (body.serviceData[0].serviceAmount !== null) {
        body.serviceData.map(async (el) => {
          const Data = {
            userId: id,
            reservationId: Id,
            serviceName: el.serviceName,
            servicePrice: el.servicePrice,
            quantity: el.serviceQuantity,
            serviceTax: el.serviceTax,
            serviceAmount: el.serviceTotal,
          };
          await DB.insert('bookingServiceV2', Data);
        });
      }
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

  // API for Update Reservation
  router.post('/changeReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('changeReservation', body);
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const reservationData = {
        userId: id,
        unitTypeId: body.unitTypeId,
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
      await DB.update('reservationV2', reservationData, { id: body.reservationId });
      if (body.guestData.length) {
        body.guestData.map(async (el) => {
          if (el.created_at) {
            const Data = {
              userId: id,
              reservationId: el.reservationId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            const updatation = await DB.update('guestV2', Data, { id: el.id });
            console.log('updatation', updatation);
          } else {
            const Data = {
              userId: id,
              reservationId: el.reservationId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            const insertion = await DB.insert('guestV2', Data);
            console.log('insertion', insertion);
          }
        });
      }

      if (body.serviceData.length) {
        body.serviceData.map(async (el) => {
          if (el.id) {
            const Data = {
              userId: id,
              reservationId: el.reservationId,
              serviceName: el.serviceName,
              servicePrice: el.servicePrice,
              quantity: el.quantity,
              serviceTax: el.serviceTax,
              serviceAmount: el.serviceAmount,
            };
            await DB.update('bookingServiceV2', Data, { id: el.id });
          } else {
            const Data = {
              userId: id,
              reservationId: el.reservationId,
              serviceName: el.serviceName,
              servicePrice: el.servicePrice,
              quantity: el.serviceQuantity,
              serviceTax: el.serviceTax,
              serviceAmount: el.serviceAmount,
            };
            await DB.insert('bookingServiceV2', Data);
          }
        });
      }

      if (body.deleteGuestId) {
        try {
          await DB.remove('guestV2', { id: body.deleteGuestId });
        } catch (e) {
          sentryCapture(e);
          res.send({
            code: 400,
            msg: e,
          });
        }
      }
      if (body.deleteServiceId) {
        try {
          await DB.remove('guestV2', { id: body.deleteServiceId });
        } catch (e) {
          sentryCapture(e);
          res.send({
            code: 400,
            msg: e,
          });
        }
      }
      res.send({
        code: 200,
        msg: 'Reservation update successfully!',
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
          const randomColor = ['#D5F8BA', '#B4FDC2', '#D2F2F3', '#BBF2E5', '#94EDD3'];
          const random = Math.floor(Math.random() * randomColor.length);
          console.log('Random', random);
          console.log('Random Color', randomColor[random]);
          const units = [];
          const rates = [];
          const normalRates = [];
          const itemsCopy = items;

          const normalRatesData = await DB.selectCol(
            ['id', 'unitTypeId', 'price_per_night', 'minimum_stay'],
            'ratesV2',
            {
              unitTypeId: items.id,
            },
          );

          normalRatesData.forEach((ele) => {
            const ratesData = {
              id: ele.id,
              unitTypeId: ele.unitTypeId,
              pricePerNight: ele.price_per_night,
              minStay: ele.minimum_stay,
            };
            normalRates.push(ratesData);
          });
          const customizeNormalRates = {
            data: normalRates,
          };

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
          itemsCopy.normalRates = customizeNormalRates;
          const reservation = await DB.selectCol(
            ['id', 'startDate', 'endDate', 'totalAmount', 'bookedUnit', 'guest'],
            'bookingV2',
            {
              unitTypeId: items.id,
            },
          );
          const unit = await DB.select('unitV2', { unitTypeId: items.id });
          if (unit.length > 0) {
            unit.forEach((ele) => {
              const unitsData = {
                id: ele.id,
                name: ele.unitName,
                color: randomColor[random],
              };
              const bookingData = [];
              reservation
                .filter((el) => el.bookedUnit === ele.id)
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
              unitsData.bookings = customizeBooking;
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

  // API for get particular Reservation Data
  router.post('/getParticularReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = [];
      const serviceData = [];
      const reservationData = await DB.select('bookingV2', { id: body.id });
      each(
        reservationData,
        async (items, next) => {
          const data = await DB.select('guestV2', { bookingId: items.id });
          if (data.length !== 0) {
            guestData.push(data);
          }
          const data1 = await DB.select('bookingServiceV2', { bookingId: items.id });
          if (data1.length !== 0) {
            serviceData.push(data1);
          }
          next();
        },
        () => {
          res.send({
            code: 200,
            guestData,
            serviceData,
            reservationData,
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

  // API for delete particular Reservation
  router.post('/deleteReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('bookingV2', { id: body.id });
      res.send({
        code: 200,
      });
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for update reservation paid status
  router.post('/updatePaid', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      await DB.update('bookingV2', { paid: body.paid }, { id: body.id });
      res.send({
        code: 200,
      });
    } catch (e) {
      console.log(e);
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for update reservation checkIn status
  router.post('/updateCheckIn', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.update('bookingV2', { checkIn: body.checkIn }, { id: body.id });
      res.send({
        code: 200,
      });
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
