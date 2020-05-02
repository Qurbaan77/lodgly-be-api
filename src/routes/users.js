const express = require('express');
// const knex = require('knex');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const userModel = require('../models/users/repositories');
const propertyModel = require('../models/property/repositories');
// const unitTypeModel = require('../models/unitType/repositories');
const DB = require('../services/database');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { hashPassword } = require('../functions');
const { verifyHash } = require('../functions');
const { clientPath } = require('../../config/default');
const { userAuthCheck } = require('../middlewares/middlewares');

const serverPath = 'http://localhost:3001/';
const usersRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // post request to signup user
  router.post('/signup', async (req, res) => {
    const { ...body } = await req.body;
    // verifying if request body data is valid
    const { isValid } = checkIfEmpty(body.username, body.password, body.email, body.package, body.mob);
    // if request body data is valid
    console.log(isValid);
    try {
      if (isValid) {
        const userExists = await userModel.getOneBy({
          email: body.email,
        });
        if (!userExists.length) {
          const hashedPassword = await hashPassword(body.password);
          if (hashedPassword) {
            body.encrypted_password = hashedPassword;
            // generating email verification hex
            const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');

            body.verificationhex = hash;

            const userData = {
              username: body.username,
              encrypted_password: body.encrypted_password,
              email: body.email,
              package: body.package,
              phone: body.mob,
              verificationhex: body.verificationhex,
            };
            const saveduser = await DB.insert('users', userData);
            console.log(saveduser);

            res.send({
              code: 200,
              msg: 'Data saved successfully, please verify your email address!',
            });

            const transporter = nodemailer.createTransport(
              smtpTransport({
                host: 'mail.websultanate.com',
                port: 587,
                auth: {
                  user: 'developer@websultanate.com',
                  pass: 'Raviwbst@123',
                },
                tls: {
                  rejectUnauthorized: false,
                },
                debug: true,
              }),
            );

            const mailOptions = {
              from: 'developer@websultanate.com',
              to: userData.email,
              subject: 'Please verify your email',
              text: `Please click on this link to verify your email address 
              ${serverPath}users/verify/${userData.verificationhex}`,
            };

            transporter.sendMail(mailOptions);
          } else {
            res.send({
              code: 400,
              msg: 'Some has error occured!',
            });
          }
        } else {
          res.send({
            code: 400,
            msg: 'Email already exists!',
          });
        }
      } else {
        res.send({
          code: 400,
          msg: 'Invalid data',
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

  // get request to verify user email
  router.get('/verify/:hex', async (req, res) => {
    try {
      const verificationhex = req.params.hex;

      const isExist = await userModel.getOneBy({ verificationhex });
      //  console.log('isExist',isExist[0].id)
      if (isExist.length) {
        const updatedData = await DB.update('users', { isvalid: true }, { id: isExist[0].id });
        // console.log('updatedData==>',updatedData)
        if (updatedData) {
          res.redirect(`${clientPath}?verified=true`);
        } else {
          res.send({
            code: 400,
            msg: 'Try Again!',
          });
        }
      } else {
        res.send({
          code: 404,
          msg: 'Verification hex not found!',
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

  // post request to login user
  router.post('/login', async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const { email, password } = req.body;
        // finding user with email
        const isUserExists = await userModel.getOneBy({
          email,
        });
        console.log(isUserExists[0]);
        if (isUserExists.length) {
          if (isUserExists[0].isvalid === false) {
            res.send({
              code: 403,
              msg: 'This email is not verified',
            });
          } else {
            const isPasswordValid = await verifyHash(password, isUserExists[0].encrypted_password);
            if (isPasswordValid) {
              // valid password
              const token = signJwt(isUserExists[0].id);
              res.cookie('token', token, {
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

  // post request for logout user
  router.post('/logout', async (req, res) => {
    console.log('logout Api called', req.signedCookies);
    res.clearCookie('token').send('cookie cleared!');
  });

  // post request for forget password
  router.post('/forgetpassword', async (req, res) => {
    console.log(req.body);
    try {
      const { newpassword, hex } = req.body;
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const userData = await userModel.getOneBy({
          forgetPassHex: hex,
        });
        if (userData.length) {
          const newhashedPassword = await hashPassword(newpassword);
          if (newhashedPassword) {
            const updateData = await DB.update(
              'users',
              {
                encrypted_password: newhashedPassword,
                forgetPassHex: '',
              },
              {
                email: userData[0].email,
              },
            );
            if (updateData) {
              res.send({
                code: 200,
                msg: 'Password updated successfully!',
              });
            } else {
              res.send({
                code: 400,
                msg: 'Try Again.',
              });
            }
          }
        } else {
          res.send({
            code: 404,
            msg: 'Wrong token',
          });
        }
      } else {
        res.send({
          code: 400,
          msg: 'Invalid input',
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

  // post request for reset password
  router.post('/resetpassword', async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      const { email } = req.body;
      if (isValid) {
        const userData = await userModel.getOneBy({
          email,
        });
        if (userData.length) {
          const forgetPassHex = crypto
            .createHmac('sha256', 'forgetPasswordHex')
            .update(userData[0].email)
            .digest('hex');
          const updatedData = await DB.update(
            'users',
            {
              forgetPassHex,
            },
            {
              email,
            },
          );

          if (updatedData) {
            const transporter = nodemailer.createTransport(
              smtpTransport({
                host: 'mail.websultanate.com',
                port: 587,
                auth: {
                  user: 'developer@websultanate.com',
                  pass: 'Raviwbst@123',
                },
                tls: {
                  rejectUnauthorized: false,
                },
                debug: true,
              }),
            );

            const mailOptions = {
              from: 'developer@websultanate.com',
              to: userData[0].email,
              subject: 'Reset your password',
              text: `Please click on this link to reset your password ${clientPath}/forgetpassword?hh=${forgetPassHex}`,
            };

            transporter.sendMail(mailOptions);

            res.send({
              code: 200,
              msg: 'Please check your email for forget password link!',
            });
          } else {
            res.send({
              code: 400,
              msg: 'Try Again.',
            });
          }
        } else {
          res.send({
            code: 404,
            msg: 'Email not found!',
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
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // get request for validating
  router.get('/validateToken', userAuthCheck, async (req, res) => {
    try {
      const { tokenData } = req.body;
      console.log('tokenData', tokenData);
      const userData = await userModel.getOneBy({ id: tokenData.userid });
      if (userData.length) {
        const resData = {
          id: userData[0].id,
          username: userData[0].username,
          email: userData[0].email,
          package: userData[0].package,
          phone: userData[0].phone,
        };
        res.send({ userData: resData, code: 200 });
      } else {
        res.send({ code: 400, msg: 'Not Valid.' });
      }
    } catch (e) {
      console.log('error', e);
      res.send({ code: 444, msg: 'Some error has occured.' });
    }
  });

  // post request to add property
  router.post('/addProperty', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const propertyData = {
        userId: body.tokenData.userid,
        propertyNo: body.propertyNo,
        propertyName: body.propertyName,
        propertyType: body.propertyType,
        address: body.address,
        country: body.country,
        state: body.state,
        city: body.city,
        zip: body.zip,
        website: body.website,

        bedrooms: body.bedroom,
        fullBathroom: body.fullBathroom,
        halfBathroom: body.halfBathroom,
        sqfoot: body.sqfoot,
        description: body.description,
      };
      const propertyExist = await propertyModel.getOneBy({
        userId: body.tokenData.userid,
        propertyNo: body.propertyNo,
      });
      console.log(propertyExist);
      if (propertyExist.length) {
        await DB.update('property', propertyData, {
          userId: body.tokenData.userid,
          propertyNo: body.propertyNo,
        });
      } else {
        await DB.insert('property', propertyData);
      }
      res.send({
        code: 200,
        msg: 'Data Saved Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!.',
      });
    }
  });

  router.post('/listing', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const { ...value } = body.value;
      console.log(body);
      console.log(value);
      const listData = {
        userId: body.tokenData.userid,
        propertyNo: body.propertyNo,
      };
      await DB.insert('listing', listData);
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/fetchProperty', async (req, res) => {
    try {
      console.log('API is called!');
      const propertiesData = await propertyModel.getOneBy({});
      console.log(propertiesData);
      if (propertiesData) {
        res.send({
          code: 200,
          propertiesData,
        });
      } else {
        res.send({
          code: 404,
          msg: 'Not Found, There is no Property!',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/addUnitType', userAuthCheck, async (req, res) => {
    try {
      console.log('addUnitType', req.body);
      const { ...body } = req.body;
      const unitTypeData = {
        propertyId: body.propertyId,
        unitTypeName: body.unitTypeName,
        startDay: body.startDay,
        endDay: body.endDay,
        perNight: body.perNight,
        roomsToSell: body.roomsToSell,
        minimumStay: body.minimumStay,
        noOfUnits: body.noOfUnits,
      };

      await DB.insert('unitType', unitTypeData);
      res.send({
        code: 200,
        msg: 'Data saved Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/updateUnitType', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unitTypeData = {
        userId: body.tokenData.userid,
        unitTypeName: body.unitTypeName,
        startDay: body.startDay,
        endDay: body.endDay,
        perNight: body.perNight,
        roomsToSell: body.roomsToSell,
        minimumStay: body.minimumStay,
        noOfUnits: body.noOfUnits,
      };

      await DB.update('unitType', unitTypeData, {
        id: body.id,
      });
      res.send({
        code: 200,
        msg: 'Data update Successfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/deleteUnitType', userAuthCheck, async (req, res) => {
    try {
      console.log(req.body);
      const unitTypeId = req.body.id;
      await DB.remove('unitType', {
        id: unitTypeId,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Successfully',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/addUnit', userAuthCheck, async (req, res) => {
    try {
      console.log('addUnitType', req.body);
      const { ...body } = req.body;
      const unitData = {
        unitTypeId: body.unitTypeId,
        unitName: body.unitName,
      };
      console.log(unitData);
      await DB.insert('unit', unitData);
      res.send({
        code: 200,
        msg: 'Data saved Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/updateUnit', userAuthCheck, async (req, res) => {
    try {
      console.log('updateUnit', req.body);
      const { ...body } = req.body;
      const unitData = {
        unitTypeId: body.unitTypeId,
        unitName: body.unitName,
      };
      console.log(unitData);
      await DB.update('unit', unitData, {
        id: body.id,
      });
      res.send({
        code: 200,
        msg: 'Data updated Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/deleteUnit', userAuthCheck, async (req, res) => {
    try {
      console.log(req.body);
      const unitId = req.body.id;
      await DB.remove('unit', {
        id: unitId,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Successfully',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  return router;
};

module.exports = usersRouter;
