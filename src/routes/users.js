const express = require('express');
// const knex = require('knex');
const crypto = require('crypto');
const randomstring = require('randomstring');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const each = require('sync-each');
const sgMail = require('@sendgrid/mail');
const userModel = require('../models/users/repositories');
// const unitTypeModel = require('../models/unitType/repositories');
const DB = require('../services/database');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { hashPassword } = require('../functions');
const { verifyHash } = require('../functions');
const { upload } = require('../functions');
const { clientPath } = require('../../config/default');
const { userAuthCheck } = require('../middlewares/middlewares');

sgMail.setApiKey('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');

// const serverPath = 'http://localhost:3001/';
const serverPath = 'http://165.22.87.22:3002/';
const usersRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // post request to signup user
  router.post('/signup', async (req, res) => {
    const { ...body } = await req.body;
    // verifying if request body data is valid
    const { isValid } = checkIfEmpty(body.username, body.password, body.email, body.package, body.phone);
    // if request body data is valid
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
              phone: body.phone,
              verificationhex: body.verificationhex,
            };
            await DB.insert('users', userData);

            const msg = {
              from: 'root@lodgly.com',
              templateId: 'd-4a2fa88c47ef4aceb6be5805eab09c46',
              personalizations: [
                {
                  to: [
                    {
                      email: userData.email,
                    },
                  ],
                  dynamic_template_data: {
                    receipt: true,
                    // username:userData.username,
                    confirmation_url: `${serverPath}users/verify/${userData.verificationhex}`,
                    email: userData.email,
                  },
                },
              ],
            };

            sgMail.send(msg, (error, result) => {
              if (error) {
                console.log(error);
                res.send({
                  code: 400,
                  msg: 'Some has error occured!',
                });
              } else {
                console.log(result);
                res.send({
                  code: 200,
                  msg: 'Data saved successfully, please verify your email address!',
                });
              }
            });

            // const transporter = nodemailer.createTransport(
            //   smtpTransport({
            //     host: 'mail.websultanate.com',
            //     port: 587,
            //     auth: {
            //       user: 'developer@websultanate.com',
            //       pass: 'Raviwbst@123',
            //     },
            //     tls: {
            //       rejectUnauthorized: false,
            //     },
            //     debug: true,
            //   }),
            // );

            // const mailOptions = {
            //   from: 'developer@websultanate.com',
            //   to: userData.email,
            //   subject: 'Please verify your email',
            //   text: `Please click on this link to verify your email address
            //   ${serverPath}users/verify/${userData.verificationhex}`,
            // };

            // transporter.sendMail(mailOptions);
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
      console.log(req.body);
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const { email, password } = req.body;
        // finding user with email
        const isUserExists = await userModel.getOneBy({
          email,
        });
        if (isUserExists.length) {
          if (isUserExists[0].isvalid === false) {
            // isvalid value need to change 0 on Live
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
                token,
              });
            } else {
              res.send({
                code: 400,
                msg: 'Password is incorrect!',
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
              text: `Please click on this link to reset your password ${clientPath}/reset?hh=${forgetPassHex}`,
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
      console.log(body);
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

        bedrooms: body.bedrooms,
        fullBathroom: body.fullBathroom,
        halfBathroom: body.halfBathroom,
        sqfoot: body.sqfoot,
        description: body.description,
      };

      const propertyExist = await DB.select('property', { userId: body.tokenData.userid, propertyNo: body.propertyNo });
      console.log(propertyExist.length);
      if (propertyExist.length) {
        await DB.update('property', propertyData, {
          userId: body.tokenData.userid,
          propertyNo: body.propertyNo,
        });
        res.send({
          code: 200,
          msg: 'Data Update Successfully!',
        });
      } else {
        await DB.insert('property', propertyData);

        res.send({
          code: 200,
          msg: 'Data Saved Successfully!',
        });
      }
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
      let Data;
      if (body.checkedValues) {
        Data = {
          petPolicy: body.checkedValues.join(', '),
        };
      } else if (body.checkedValues1) {
        Data = {
          feature1: body.checkedValues1.join(', '),
        };
      } else if (body.checkedValues2) {
        Data = {
          feature2: body.checkedValues2.join(', '),
        };
      } else if (body.checkedValues3) {
        Data = {
          feature3: body.checkedValues3.join(', '),
        };
      }
      await DB.update('property', Data, { propertyNo: body.No });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/fetchProperty', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      // const userData = await DB.select('user', )
      const propertiesData = await DB.select('property', { userId: body.tokenData.userid });
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
      const { ...body } = req.body;
      let start;
      let end;
      if (body.groupname) {
        start = Date.parse(body.groupname[0].split('T', 1));
        end = Date.parse(body.groupname[1].split('T', 1));
      }
      const unitTypeData = {
        userId: body.tokenData.userid,
        propertyId: body.propertyId,
        unitTypeName: body.name,
        startDay: start,
        endDay: end,
        perNight: body.perNight,
        roomsToSell: body.roomsToSell,
        minimumStay: body.minimumStay,
        noOfUnits: body.noOfUnits,
      };

      if (body.id) {
        await DB.update('unitType', unitTypeData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data updated Successfully!',
        });
      } else {
        await DB.insert('unitType', unitTypeData);
        res.send({
          code: 200,
          msg: 'Data saved Successfully!',
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

  // API for fetch unittype
  router.post('/getUnittype', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unittypeData = await DB.select('unitType', { propertyId: body.propertyId });
      if (unittypeData) {
        res.send({
          code: 200,
          unittypeData,
        });
      } else {
        res.send({
          code: 401,
          msg: 'No Unittype Saved',
        });
      }
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/addUnit', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unitData = {
        userId: body.tokenData.userid,
        propertyId: body.propertyId,
        unittypeId: body.unittypeId,
        unitName: body.unitName,
      };
      if (body.id) {
        await DB.update('unit', { unitName: body.unitName }, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data updated Successfully!',
        });
      } else {
        await DB.insert('unit', unitData);
        res.send({
          code: 200,
          msg: 'Data saved Successfully!',
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

  // API for get unit data
  router.post('/getUnit', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('Body', body);
      const unitData = await DB.select('unit', { propertyId: body.propertyId });
      res.send({
        code: 200,
        unitData,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/addGroup', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const groupData = {
        userId: body.tokenData.userid,
        groupName: body.groupname,
        checkCount: body.count,
        checkInterval: body.interval,
        prevCheck: body.prevCheck.split('T', 1),
        nextCheck: body.nextCheck.split('T', 1),
      };
      if (body.id) {
        await DB.update('groups', groupData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('groups', groupData);
        res.send({
          code: 200,
          msg: 'Data saved successfully!',
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

  router.post('/groupList', userAuthCheck, async (req, res) => {
    try {
      const groupDetail = await DB.select('groups', {});
      res.send({
        code: 200,
        groupDetail,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });
  router.post('/editGroup', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const groupData = {
        groupName: body.groupName,
        checkCount: body.checkCount,
        checkInterval: body.checkInterval,
        prevCheck: body.prevCheck,
        nextCheck: body.nextCheck,
      };
      await DB.update('groups', groupData, { userId: body.tokenData.userid, id: body.id });
      res.send({
        code: 200,
        msg: 'updated successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/deleteGroup', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const groupId = body.id;
      await DB.remove('groups', {
        id: groupId,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Successfully',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/addTask', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const taskData = {
        name: body.name,
        address: body.address,
        tags: body.tags,
      };
      if (body.id) {
        await DB.update('task', taskData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Task Update Successfully!',
        });
      } else {
        await DB.insert('task', taskData);
        res.send({
          code: 200,
          msg: 'Task Save Successfully!',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/deleteTask', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const taskId = body.id;
      await DB.remove('task', {
        id: taskId,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Successfully',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/taskList', userAuthCheck, async (req, res) => {
    try {
      console.log('API is called!');
      const taskDetail = await DB.select('task', {});
      res.send({
        code: 200,
        taskDetail,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/addBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('addBooking', body);
      const bookingData = {
        userId: body.tokenData.userid,
        propertyId: body.property,
        propertyName: body.propertyName,
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
      };

      const Id = await DB.insert('booking', bookingData);
      console.log('ID', Id);
      body.guestData.map(async (el) => {
        const Data = {
          userId: body.tokenData.userid,
          bookingId: Id,
          fullname: el.fullName,
          country: el.country,
          email: el.email,
          phone: el.phone,
        };
        await DB.insert('guest', Data);
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

      body.serviceData.map(async (el) => {
        const Data = {
          bookingId: Id,
          serviceName: el.serviceName,
          servicePrice: el.servicePrice,
          quantity: el.serviceQunatity,
        };
        await DB.insert('bookingService', Data);
      });

      res.send({
        code: 200,
        msg: 'Booking save successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/getBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = [];
      const serviceData = [];
      const bookingData = await DB.select('booking', { userId: body.tokenData.userid });
      const unittypeData = await DB.select('unitType', { userId: body.tokenData.userid });
      each(
        bookingData,
        async (items, next) => {
          const data = await DB.select('guest', { bookingId: items.id });
          if (data.length !== 0) {
            guestData.push(data);
          }
          const data1 = await DB.select('bookingService', { bookingId: items.id });
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
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for change Booking
  router.post('/changeBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const bookingDetail = await DB.select('booking', { id: body.id, userId: body.tokenData.userid });
      if (bookingDetail) {
        const bookingData = {
          userId: body.tokenData.userid,
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
        await DB.update('booking', bookingData, { id: body.id, userId: body.tokenData.userid });
        res.send({
          code: 200,
          msg: 'Booking change successfully!',
        });
      }
      if (body.guestData.length) {
        body.guestData.map(async (el) => {
          if (el.id) {
            const Data = {
              userId: body.tokenData.userid,
              bookingId: el.bookingId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            await DB.update('guest', Data, { id: el.id });
          } else {
            const Data = {
              userId: body.tokenData.userid,
              bookingId: el.bookingId,
              fullname: el.fullname,
              country: el.country,
              email: el.email,
              phone: el.phone,
            };
            console.log(Data);
            await DB.insert('guest', Data);
          }
        });
      }

      console.log(body.serviceData);
      if (body.serviceData.length) {
        body.serviceData.map(async (el) => {
          if (el.id) {
            const Data = {
              userId: body.tokenData.userid,
              bookingId: el.bookingId,
              serviceName: el.serviceName,
              servicePrice: el.servicePrice,
              quantity: el.quantity,
              serviceTax: el.serviceTax,
              serviceAmount: el.serviceAmount,
            };
            await DB.update('bookingService', Data, { id: el.id });
          } else {
            const Data = {
              userId: body.tokenData.userid,
              bookingId: el.bookingId,
              serviceName: el.serviceName,
              servicePrice: el.servicePrice,
              quantity: el.serviceQuantity,
              serviceTax: el.serviceTax,
              serviceAmount: el.serviceAmount,
            };
            await DB.insert('bookingService', Data);
          }
        });
      }

      if (body.deleteGuestId) {
        try {
          await DB.remove('guest', { id: body.deleteGuestId });
        } catch (err) {
          res.send({
            code: 400,
            msg: err,
          });
        }
      }
      if (body.deleteServiceId) {
        try {
          await DB.remove('guest', { id: body.deleteServiceId });
        } catch (err) {
          res.send({
            code: 400,
            msg: err,
          });
        }
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/filterBooking', userAuthCheck, async (req, res) => {
    try {
      const bookingDetail = await DB.select('booking', {});
      res.send({
        code: 200,
        bookingDetail,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/addGuest', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      let Dob = null;
      if (body.dob) {
        Dob = body.dob.split('T', 1);
      }
      const guestData = {
        userId: body.tokenData.userid,
        bookingId: body.bookingId,
        reservationId: body.reservationId,
        fullName: body.fullName,
        country: body.country,
        email: body.email,
        phone: body.phone,
        dob: Dob,
        gender: body.gender,
        typeOfDoc: body.typeOfDoc,
        docNo: body.docNo,
        citizenShip: body.citizenShip,
        place: body.place,
        notes: body.notes,
      };
      if (body.id) {
        await DB.update('guest', guestData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data updated successfully!',
        });
      } else {
        await DB.insert('guest', guestData);
        if (body.reservationId) {
          await DB.increment(
            'reservation',
            {
              id: body.reservationId,
            },
            {
              noGuest: 1,
            },
          );
        } else {
          await DB.increment(
            'booking',
            {
              id: body.bookingId,
            },
            {
              noGuest: 1,
            },
          );
        }
        res.send({
          code: 200,
          msg: 'Data Save Successfully!',
        });
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/editGuest', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = {
        fullName: body.fullName,
        country: body.country,
        email: body.email,
        phone: body.phone,
        dob: body.dob,
        gender: body.gender,
        typeOfDoc: body.typeOfDoc,
        docNo: body.docNo,
        citizenShip: body.citizenShip,
        place: body.place,
        notes: body.notes,
      };
      await DB.update('guest', guestData, { id: body.guestId });
      res.send({
        code: 200,
        msg: 'Data Update Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error occured!',
      });
    }
  });

  router.post('/deleteGuest', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('guest', { id: body.guestId });
      if (body.bookingId) {
        await DB.decrement(
          'booking',
          {
            id: body.bookingId,
          },
          {
            noGuest: 1,
          },
        );
      } else {
        await DB.decrement(
          'reservation',
          {
            id: body.reservationId,
          },
          {
            noGuest: 1,
          },
        );
      }
      res.send({
        code: 200,
        msg: 'Data Deleted Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // post api for add reservation
  router.post('/addReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const reservationData = {
        userId: body.tokenData.userid,
        propertyId: body.property,
        unitId: body.unit,
        startDate: Date.parse(body.groupname[0].split('T', 1)),
        endDate: Date.parse(body.groupname[1].split('T', 1)),
        acknowledge: body.acknowledge,
        channel: body.channel,
        commission: body.commission,
        adult: body.adult,
        guest: body.guest,
        children1: body.children1,
        children2: body.children2,
        notes1: body.notes1,
        notes2: body.notes2,
        discount: body.discount,
        noOfservices: body.noOfservices,
        totalAmount: body.totalAmount,
        deposit: body.deposit,
      };
      const Id = await DB.insert('reservation', reservationData);
      body.guestData.map(async (el) => {
        const Data = {
          userId: body.tokenData.userid,
          reservationId: Id,
          fullname: el.fullName,
          country: el.country,
          email: el.email,
          phone: el.phone,
        };
        await DB.insert('guest', Data);
        await DB.increment(
          'reservation',
          {
            id: Id,
          },
          {
            noGuest: 1,
          },
        );
      });

      res.send({
        code: 200,
        msg: 'Data add successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get reservation
  router.post('/getReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = [];
      const reservationData = await DB.select('reservation', { userId: body.tokenData.userid });
      each(
        reservationData,
        async (items, next) => {
          const data = await DB.select('guest', { reservationId: items.id });
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
      const unitType = await DB.select('unitType', { userId: body.tokenData.userid });
      const unit = await DB.select('unit', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        unittypeData: unitType,
        unitData: unit,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for edit reservation
  router.post('/editReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const reservationData = {
        startDate: body.startDate,
        endDate: body.endDate,
        acknowledge: body.acknowledge,
        property: body.property,
        unit: body.unit,
        channel: body.channel,
        commission: body.commission,
        adult: body.adult,
        children1: body.children1,
        children2: body.children2,
        noGuest: body.noGuest,
        notes1: body.notes1,
        notes2: body.notes2,
        discount: body.discount,
        pricePerNight: body.pricePerNight,
        services: body.services,
        deposit: body.deposit,
      };
      await DB.update('reservation', reservationData, { id: body.reservationId });
      res.send({
        code: 200,
        msg: 'Data Update Successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for delete reservation
  router.post('/deleteReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('reservation', { id: body.reservationId });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for add/update Invoice
  router.post('/addInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const invoiceData = {
        userId: body.tokenData.userid,
        propertyId: body.propertyId,
        label: body.label,
        type: body.type,
        status: body.status,
        date: body.date,
        time: body.time,
        deliveryDate: body.deliveryDate,
        dueDate: body.dueDate,
        paymentType: body.paymentType,
        clientName: body.clientName,
        email: body.email,
        address: body.address,
        vatId: body.vatId,
        itemDesc: body.itemDesc,
        amount: body.amount,
        impression: body.impression,
      };
      if (body.id) {
        await DB.update('invoice', invoiceData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('invoice', invoiceData);
        res.send({
          code: 200,
          msg: 'Data save successfully!',
        });
      }
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for delete invoice
  router.post('/deleteInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const invoiceId = body.id;
      await DB.remove('invoice', { id: invoiceId });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for cancellation
  router.post('/cancelInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const invoiceId = req.id;
      const invoiceData = {
        status: body.status,
      };
      await DB.update('invoice', invoiceData, { id: invoiceId });
      res.send({
        code: 200,
        msg: 'Invoice Cancelled!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for fetch Invoices
  router.post('/getInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const InvoiceData = await DB.select('invoice', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        InvoiceData,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // APi for filter/fetch Invoices
  router.post('/filterInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const InvoiceData = await DB.selectOr('invoice', {
        date: body.date,
        label: body.label,
        type: body.type,
        clientName: body.clientName,
        amount: body.amount,
        status: body.status,
      });
      res.send({
        code: 200,
        InvoiceData,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for add team
  router.post('/addTeam', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userExists = await userModel.getOneBy({
        email: body.email,
      });
      if (!userExists.length) {
        const password = randomstring.generate(7);
        console.log(password);
        const hashedPassword = await hashPassword(password);
        const teamData = {
          userId: body.tokenData.userid,
          email: body.email,
          role: body.role,
          bookingRead: body.bookingRead,
          bookingWrite: body.bookingRead,
        };
        if (body.id) {
          await DB.update('team', teamData, { id: body.id });
          res.send({
            code: 200,
            msg: 'Data update successfully!',
          });
        } else {
          await DB.insert('team', teamData);
          const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
          const userData = {
            email: body.email,
            verificationhex: hash,
            encrypted_password: hashedPassword,
          };
          await DB.insert('users', userData);
          res.send({
            code: 200,
            msg: 'Data save successfully!',
          });
        }
      } else {
        res.send({
          code: 400,
          msg: 'Email already exists!',
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

  // API for get sub user details
  router.post('/getSubUser', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userData = await DB.select('users', { id: body.tokenData.userid });
      console.log(userData[0].email);
      const subUser = await DB.select('team', { email: userData[0].email });
      res.send({
        code: 200,
        subUser,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for delete team
  router.post('/deleteTeam', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('team', { id: body.teamId });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for adding sub owner
  router.post('/addOwner', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    try {
      let Dob = null;
      const password = randomstring.generate(7);
      const hashedPassword = await hashPassword(password);
      if (body.dob) {
        Dob = body.dob.split('T', 1);
      }
      const ownerData = {
        userId: body.tokenData.userid,
        fname: body.firstname,
        lname: body.secondname,
        email: body.email,
        phone: body.phone,
        dob: Dob,
        gender: body.gender,
        country: body.country,
        citizenship: body.citizenship,
        address: body.address,
        typeOfDoc: body.document,
        docNo: body.documentnumber,
        notes: body.notes,
      };
      if (body.id) {
        await DB.update('owner', ownerData, { id: body.id });
        await DB.update('property', { ownerId: 0 }, { ownerId: body.id });
        each(body.properties, async (items, next) => {
          await DB.update('property', { ownerId: body.id }, { id: items });
          next();
        });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        const saveData = await DB.insert('owner', ownerData);
        each(body.properties, async (items, next) => {
          await DB.update('property', { ownerId: saveData }, { id: items });
          next();
        });
        const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
        const userData = {
          affiliateId: body.tokenData.userid,
          username: body.username,
          email: body.email,
          phone: body.phone,
          verificationhex: hash,
          encrypted_password: hashedPassword,
        };
        await DB.insert('users', userData);
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
          to: ownerData.email,
          subject: 'Please verify your email',
          text: `You can now access to Owner' s panle for
          your properties. Your login details: ${password}. You can login here
          ${serverPath}users/verify/${userData.verificationhex}`,
        };

        transporter.sendMail(mailOptions);
      }
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get sub user details
  router.post('/getOwner', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const data = await DB.select('owner', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        data,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for remove owner
  router.post('/deleteOwner', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('owner', { id: body.id });
      await DB.update('property', { ownerId: 0 }, { ownerId: body.id });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  // API for add perosnal detail, company info, application setting
  router.post('/addInfo', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const persolData = {
        fname: body.fname,
        lname: body.lname,
        address: body.address,
        email: body.email,
        phone: body.phone,

        companyName: body.companyName,
        country: body.country,
        state: body.state,
        city: body.city,
        zip: body.zip,
        vatId: body.vatId,

        uiLang: body.uiLang,
        timezone: body,
      };
      await DB.update('users', persolData, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Data updated successfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for detail of users
  router.post('/getInfo', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userInfo = await DB.select('users', { id: body.tokenData.userid });
      res.send({
        code: 200,
        userInfo,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for upload picture
  router.post('/photo', upload.single('file'), (req, res) => {
    console.log(req);
    return res.json({
      image: req.file.path,
    });
  });

  // API for add Services of Property
  router.post('/addService', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const servicData = {
        propertyId: body.propertyNo,
        serviceName: body.servicename,
        servicePrice: body.serviceprice,
        quantity: body.servicequantity,
      };
      if (body.serviceId) {
        await DB.update('service', servicData, { id: body.serviceId });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('service', servicData);
        res.send({
          code: 200,
          msg: 'Data save successfully!',
        });
      }
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for listing of services
  router.post('/getService', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const servicData = await DB.select('service', {
        propertyId: body.propertyId,
      });
      res.send({
        code: 200,
        servicData,
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for delete Service
  router.post('/deleteService', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('service', {
        id: body.id,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Sucessfully!',
      });
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for validate login
  router.post('/validateToken', userAuthCheck, async (req, res) => {
    try {
      res.send({
        code: 200,
        status: true,
      });
    } catch (e) {
      res.send({
        code: 406,
        msg: 'Some error has occured!',
      });
    }
  });

  return router;
};

module.exports = usersRouter;
