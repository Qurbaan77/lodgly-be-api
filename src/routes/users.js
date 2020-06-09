const express = require('express');
// const knex = require('knex');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const each = require('sync-each');
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

const serverPath = 'http://localhost:3001/';
// const serverPath = 'http://165.22.87.22:3002/';
const usersRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // post request to signup user
  router.post('/signup', async (req, res) => {
    const { ...body } = await req.body;
    // verifying if request body data is valid
    const { isValid } = checkIfEmpty(body.username, body.password, body.email, body.package, body.phone);
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
              phone: body.phone,
              verificationhex: body.verificationhex,
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
              })
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
                token,
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
              }
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
            }
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
              })
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
      const unitTypeData = {
        propertyId: body.propertyId,
        unitTypeName: body.unitTypeName,
        startDay: body.groupname[0].split('T', 1),
        endDay: body.groupname[1].split('T', 1),
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
      console.log('addUnit', body);
      const unitData = {
        propertyId: body.propertyId,
        unittypeId: body.unittypeId,
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

  // API for get unit data
  router.post('/getUnit', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
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
      console.log(body);
      const bookingData = {
        userId: body.tokenData.userid,
        propertyId: body.property,
        unitId: body.unit,
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
        discount: body.discount,
        noOfservices: body.noOfservices,
        totalAmount: body.totalAmount,
        deposit: body.deposit,
      };

      const Id = await DB.insert('booking', bookingData);
      console.log("ID", Id)
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
            }
          );
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
      const bookingData = await DB.select('booking', { userId: body.tokenData.userid });
      each(
        bookingData,
        async function (items, next) {
          const data = await DB.select('guest', { bookingId: items.id });
          guestData.push(data);
          next();
        },
        function () {
          res.send({
            code: 200,
            bookingData,
            guestData,
          });
        }
      );
    } catch (e) {
      res.send({
        code: 444,
        msg: 'Some Error has occured!',
      });
    }
  });

  router.post('/changeBooking', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const bookingDetail = await DB.select('booking', { id: body.id, userId: body.tokenData.userid });
      if (bookingDetail) {
        const bookingData = {
          userId: body.tokenData.userid,
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
          guestDetail: body.guestDetail,
          notes1: body.notes1,
          notes2: body.notes2,
          services: body.services,
          accomodation: body.accomodation,
          depositAccomodation: body.depositAccomodation,
          discount: body.discount,
        };
        await DB.update('booking', bookingData, { id: body.id, userId: body.tokenData.userid });
        res.send({
          code: 200,
          msg: 'Booking change successfully!',
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
      const dob = null;
      if(body.dob) {
        dob = body.dob.split('T', 1)
      }
      const guestData = {
        userId: body.tokenData.userid,
        bookingId: body.bookingId,
        reservationId: body.reservationId,
        fullName: body.fullName,
        country: body.country,
        email: body.email,
        phone: body.phone,
        dob: dob,
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
            }
          );
        } else {
          await DB.increment(
            'booking',
            {
              id: body.bookingId,
            },
            {
              noGuest: 1,
            }
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
          }
        );
      } else {
        await DB.decrement(
          'reservation',
          {
            id: body.reservationId,
          },
          {
            noGuest: 1,
          }
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
      const reservationData = {
        userId: body.tokenData.userid,
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
      await DB.insert('reservation', reservationData);
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
      const teamData = {
        userId: body.tokenData.userid,
        email: body.email,
        role: body.role,
        dates: body.dates,
        rates: body.rates,
        guest: body.guest,
        services: body.services,
        invoices: body.invoices,
        cashReg: body.cashReg,
        ratesAval: body.ratesAval,
        dashboard: body.dashboard,
        stats: body.stats,
        setting: body.setting,
      };
      if (body.id) {
        await DB.update('team', teamData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('team', teamData);
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

  // API for add owner
  router.post('/addOwner', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const ownerData = {
        userId: body.tokenData.userid,
        fname: body.fname,
        lname: body.lname,
        email: body.email,
        phone: body.phone,
        dob: body.dob,
        gender: body.gender,
        country: body.country,
        citizenShip: body.citizenShip,
        places: body.places,
        typeOfDoc: body.typeOfDoc,
        docNo: body.docNo,
        properties: body.properties,
        notes: body.notes,
      };
      if (body.id) {
        await DB.update('owner', ownerData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('owner', ownerData);
        res.send({
          code: 200,
          msg: 'Data saves successfully!',
        });
      }
    } catch (e) {
      res.send({
        code: 200,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for remove owner
  router.post('/deleteOwner', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('owner', { id: body.id });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
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
      await DB.insert('service', servicData);
      res.send({
        code: 200,
        msg: 'Data save successfully!',
      });
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
