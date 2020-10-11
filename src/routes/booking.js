const express = require('express');
const each = require('sync-each');
const DB = require('../services/database');
const { userAuthCheck } = require('../middlewares/middlewares');
const sentryCapture = require('../../config/sentryCapture');
// const { pushBooking } = require('../channelManagement');

const bookingRouter = () => {
  const router = express.Router();

  // API for add booking
  router.post('/addBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('addBooking', body);
      let id;
      const startDateTime = new Date(body.groupname[0]);
      const endDateTime = new Date(body.groupname[1]);

      if (!body.affiliateId) {
        console.log('no affiliaate id');
        id = body.tokenData.userid;
      } else {
        console.log('affiliate id');
        id = body.affiliateId;
        console.log(id);
      }
      const bookingData = {
        userId: id,
        unitTypeId: body.property,
        propertyName: body.propertyName,
        bookedUnit: body.unit,
        unitName: body.unitName,
        startDate: startDateTime,
        endDate: endDateTime,
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
      const Id = await DB.insert('bookingV2', bookingData);
      if (body.guestData[0] !== null) {
        body.guestData.map(async (el) => {
          let Dob = null;
          if (el.dob) {
            Dob = el.dob.split('T', 1);
          }
          const Data = {
            userId: id,
            bookingId: Id,
            fullname: el.fullName,
            country: el.country,
            email: el.email,
            phone: el.phone,
            dob: Dob,
            gender: el.gender,
            typeOfDoc: el.typeOfDoc,
            docNo: el.docNo,
            citizenShip: el.citizenShip,
            place: el.place,
            notes: el.notes,
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
            bookingId: Id,
            serviceName: el.serviceName,
            servicePrice: el.servicePrice,
            quantity: el.serviceQuantity,
            serviceTax: el.serviceTax,
            serviceAmount: el.serviceTotal,
          };
          await DB.insert('bookingServiceV2', Data);
        });
      }
      // const data = await DB.selectCol(['isChannelManagerActivated'], 'unitTypeV2', { id: body.property });
      // const [{ isChannelManagerActivated }] = data;
      // console.log('channel manager activated', isChannelManagerActivated);
      // /**
      //  * if user's channel manager is activated push this booking to channex
      //  */
      // if (false) {
      //   const planId = await DB.selectCol(['channexRatePlanId'], 'channelManager', { unitTypeId: body.property });
      //   const [{ ratePlanId }] = planId;
      //   const newBookingData = {
      //     id: Id,
      //     startDate: startDateTime,
      //     endDate: endDateTime,
      //     guest: body.guest,
      //     adult: body.adult,
      //     children: body.children1,
      //     infant: body.children2,
      //     ratePlanId,
      //     days: body.priceOnEachDay,
      //   };
      //   await pushBooking(ratePlanId, newBookingData);
      // }
      res.send({
        code: 200,
        msg: 'Booking save successfully!',
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

  // Update Booking
  router.post('/changeBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('changeBooking', body);
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const bookingDetail = await DB.select('bookingV2', { id: body.id, userId: id });
      if (bookingDetail) {
        const bookingData = {
          userId: id,
          propertyId: body.propertyId,
          propertyName: body.property,
          unitId: body.unit,
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
          depositType: body.depositType,
        };
        await DB.update('bookingV2', bookingData, { id: body.id, userId: id });
      }
      if (body.guestData.length) {
        body.guestData.map(async (el) => {
          if (el.created_at) {
            const Data = {
              userId: id,
              bookingId: el.bookingId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            await DB.update('guestV2', Data, { id: el.id });
          } else {
            const Data = {
              userId: id,
              bookingId: el.bookingId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            await DB.insert('guestV2', Data);
          }
        });
      }

      console.log(body.serviceData);
      if (body.serviceData.length) {
        body.serviceData.map(async (el) => {
          if (el.id) {
            const Data = {
              userId: id,
              bookingId: el.bookingId,
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
              bookingId: el.bookingId,
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
        msg: 'Booking change successfully!',
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

  // API for get booking
  router.post('/getBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = [];
      const serviceData = [];
      let bookingData;
      let unittypeData;
      if (!body.affiliateId) {
        bookingData = await DB.select('bookingV2', { userId: body.tokenData.userid });
        unittypeData = await DB.select('unitTypeV2', { userId: body.tokenData.userid });
      } else {
        bookingData = await DB.select('bookingV2', { userId: body.affiliateId });
        unittypeData = await DB.select('unitTypeV2', { userId: body.affiliateId });
      }
      each(
        bookingData,
        async (items, next) => {
          const data = await DB.select('guestV2', { bookingId: items.id });
          if (data.length !== 0) {
            guestData.push(data);
          }
          console.log(items.id);
          const data1 = await DB.select('bookingServiceV2', { bookingId: items.id });
          if (data1.length !== 0) {
            serviceData.push(data1);
          }
          next();
        },
        () => {
          res.send({
            code: 200,
            bookingData,
            guestData,
            serviceData,
            unittypeData,
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

  // API for deleting bookings
  router.post('/deleteBookings', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      each(
        body.bookings,
        async (items, next) => {
          const itemsCopy = items;
          await DB.remove('bookingV2', { id: items });
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            msg: 'Booking delete successfully!',
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for set status of booking
  router.post('/setStatus', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let colour;
      if (body.status === 'booked') {
        colour = 'red';
      } else if (body.status === 'open') {
        colour = 'green';
      } else if (body.status === 'tentative') {
        colour = 'orange';
      } else if (body.status === 'decline') {
        colour = 'grey';
      }
      await DB.update('bookingV2', { status: body.status, statusColour: colour }, { id: body.bookingId });
      res.send({
        code: 200,
        msg: 'Status added successfully!',
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

  // API for get all Booking
  router.post('/getAllBooking', userAuthCheck, async (req, res) => {
    try {
      const allBookingData = await DB.select('bookingV2', {});
      res.send({
        code: 200,
        allBookingData,
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
  return router;
};

module.exports = bookingRouter;
