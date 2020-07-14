const express = require('express');
const DB = require('../services/database');
const ownerModel = require('../models/owner/repositories');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { verifyHash } = require('../functions');
const { ownerAuthCheck } = require('../middlewares/middlewares');

const ownerRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // login API for Owner Panel
  router.post('/ownerLogin', async (req, res) => {
    try {
      console.log(req.body);
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const { email, password } = req.body;
        // finding user with email
        const isOwnerExists = await ownerModel.getOneBy({
          email,
        });

        if (isOwnerExists.length) {
          const isPasswordValid = await verifyHash(password, isOwnerExists[0].encrypted_password);
          console.log(isPasswordValid);
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

  // API for fetch Owner property details
  router.post('/getProperty', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const propertyData = await DB.select('property', { ownerId: body.tokenData.userid });
      res.send({
        code: 200,
        propertyData,
      });
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
      console.log(body);
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
