const express = require('express');
const each = require('sync-each');
const DB = require('../services/database');
const ownerModel = require('../models/owner/repositories');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { hashPassword } = require('../functions');
const { verifyHash } = require('../functions');
const { ownerAuthCheck } = require('../middlewares/middlewares');

const ownerRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // login API for Owner Panel
  router.post('/ownerLogin', async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const { email, password } = req.body;
        // finding user with email
        const isOwnerExists = await ownerModel.getOneBy({
          email,
        });

        if (isOwnerExists.length) {
          const isPasswordValid = await verifyHash(password, isOwnerExists[0].encrypted_password);
          if (isPasswordValid) {
            // valid password
            const token = signJwt(isOwnerExists[0].id);
            res.cookie('token', token, {
              maxAge: 999999999999,
              signed: true,
            });
            res.send({
              code: 200,
              msg: 'Authenticated',
              token,
            });
          } else {
            res.send({
              code: 400,
              msg: 'Password is incorrect!',
            });
          }
        } else {
          res.send({
            code: 404,
            msg: 'User not found!',
          });
        }
      } else {
        res.send({
          code: 400,
          msg: 'Invalid request body',
        });
      }
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // post request for logout Owner
  router.post('/ownerLogout', async (req, res) => {
    res.clearCookie('token').send('cookie cleared!');
  });

  // API for fetch Owner property details
  router.post('/getProperty', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const propertyData = await DB.select('property', { ownerId: body.tokenData.userid });
      each(
        propertyData,
        async (items, next) => {
          const itemsCopy = items;
          const data = await DB.select('booking', { propertyId: items.id });
          const data2 = await DB.selectCol('perNight', 'unitType', { propertyId: items.id });
          itemsCopy.noBookedNights = data.length;
          itemsCopy.perNight = data2[0].perNight;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            propertyData,
          });
        },
      );
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for adding info of Owner
  router.post('/addOwnerInfo', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const ownerData = {
        fname: body.firstname,
        lname: body.lastname,
        email: body.email,
        phone: body.phone,
      };
      await DB.update('owner', ownerData, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Data save successfully!',
      });
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for fetch Owner Details
  router.post('/getOwnerInfo', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const ownerData = await DB.select('owner', { id: body.tokenData.userid });
      res.send({
        code: 200,
        ownerData,
      });
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for change password
  router.post('/changePassword', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const ownerData = await DB.select('owner', { id: body.tokenData.userid });
      const isPasswordValid = await verifyHash(body.oldPassword, ownerData[0].encrypted_password);
      if (isPasswordValid) {
        const hashedPassword = await hashPassword(body.newPassword);
        await DB.update('owner', { encrypted_password: hashedPassword }, { id: body.tokenData.userid });
        res.send({
          code: 200,
          msg: 'Password change successfully!',
        });
      } else {
        res.send({
          code: 401,
          msg: 'Invalid Credential!',
        });
      }
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });
  return router;
};

module.exports = ownerRouter;
