const express = require('express');
const crypto = require('crypto');
const adminModel = require('../models/admin/repositories');
const DB = require('../services/database');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { hashPassword } = require('../functions');
const { verifyHash } = require('../functions');
const { adminAuthCheck } = require('../middlewares/middlewares');

const adminRouter = () => {
  // router variable for api routing
  const router = express.Router();
  // post request to signup user
  router.post('/register', async (req, res) => {
    const { ...body } = req.body;
    console.log('/register', body);
    // verifying if request body data is valid
    const { isValid } = checkIfEmpty(body.email, body.password, body.phone);
    console.log(isValid);
    // if requested data is valid
    try {
      if (isValid) {
        const adminExist = await adminModel.getOneBy({
          email: body.email,
        });
        console.log(adminExist);
        if (!adminExist.length) {
          const hashedPassword = await hashPassword(body.password);
          if (hashedPassword) {
            body.encrypted_password = hashedPassword;
            // generating email verification hex
            const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');

            body.verificationhex = hash;
            const adminData = {
              email: body.email,
              phone: body.phone,
              encrypted_password: body.encrypted_password,
              verificationhex: body.verificationhex,
            };
            const savedAdmin = await DB.insert('admin', adminData);
            console.log(savedAdmin);
            res.send({
              code: 200,
              msg: 'Data Saved Successfully',
            });
          } else {
            res.send({
              code: 400,
              msg: 'Some has error occured!',
            });
          }
        } else {
          res.send({
            code: 400,
            msg: 'Email Already Exists',
          });
        }
      } else {
        res.send({
          code: 400,
          msg: 'Invalid Data',
        });
      }
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 400,
        msg: 'Some error has occured!',
      });
    }
  });

  // post request to login Admin
  router.post('/login', async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const { email, password } = req.body;
        // finding user with email
        const isAdminExists = await adminModel.getOneBy({
          email,
        });
        console.log('password', password);
        if (isAdminExists.length) {
          const isPasswordValid = await verifyHash(password, isAdminExists[0].encrypted_password);
          console.log('isAdminExists[0].encrypted_password', isAdminExists[0].encrypted_password);
          if (isPasswordValid) {
            // valid password
            const token = signJwt(isAdminExists[0].id);
            res.cookie('adminToken', token, {
              maxAge: 999999999999,
              signed: true,
            });
            res.send({
              code: 200,
              msg: 'Authenticated',
            });
          } else {
            res.send({
              code: 400,
              msg: 'Invalid Login Details!',
            });
          }
        } else {
          res.send({
            code: 404,
            msg: 'Admin not found!',
          });
        }
      }
    } catch (e) {
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // post request for logout Admin
  router.post('/logout', async (req, res) => {
    res.clearCookie('adminToken').send('cookie cleared!');
  });

  router.post('/addProperty', adminAuthCheck, async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const propertyData = {
          type: req.body.property,
        };
        const savedProperty = await DB.insert('propertyType', propertyData);
        console.log(savedProperty);
        res.send({
          code: 200,
          msg: 'Data Saved Successfully',
        });
      } else {
        res.send({
          code: 404,
          msg: 'Invalid Data',
        });
      }
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/deleteProperty', adminAuthCheck, async (req, res) => {
    try {
      console.log(req.body);
      const properyId = req.body.id;
      await DB.remove('propertyType', {
        id: properyId,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Successfully',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // change Password
  router.post('/changePassword', adminAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const hashedPassword = await hashPassword(body.password);
      if (hashedPassword) {
        const passwordData = {
          encrypted_password: hashedPassword,
        };
        await DB.update('admin', passwordData, { id: body.tokenData.userid });
        res.send({
          code: 200,
          msg: 'Password Change Successfully',
        });
      } else {
        res.send({
          code: 400,
          msg: 'Some has error occured!',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 400,
        msg: 'some error occured!',
      });
    }
  });

  // Complete profile detail
  router.post('/completeProfile', adminAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const adminData = {
        fname: body.fname,
        lname: body.lname,
        email: body.email,
        phone: body.phone,
      };
      await DB.update('admin', adminData, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Data save successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  return router;
};

module.exports = adminRouter;
