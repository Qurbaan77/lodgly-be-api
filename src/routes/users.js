const express = require('express');
const config = require('config');
const crypto = require('crypto');
const randomstring = require('randomstring');
// const nodemailer = require('nodemailer');
// const smtpTransport = require('nodemailer-smtp-transport');
const each = require('sync-each');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const AWS = require('aws-sdk');
const fileType = require('file-type');
const bluebird = require('bluebird');
const multiparty = require('multiparty');
const pdf = require('html-pdf');
const stripe = require('stripe')(config.get('payments.stripeApiKey'));
const userModel = require('../models/users/repositories');
const DB = require('../services/database');
const {
  hashPassword, verifyHash, checkIfEmpty, signJwt,
} = require('../functions');
const { frontendUrl } = require('../functions/frontend');
const { userAuthCheck } = require('../middlewares/middlewares');
const invoiceTemplate = require('../invoiceTemplate/invoiceTemplate');

AWS.config.setPromisesDependency(bluebird);
// const clientPath = domainName('app');
// const serverPath = config.get('serverPath');
const usersRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // AWS S3 upload function'
  const s3 = new AWS.S3({
    accessKeyId: config.get('aws.accessKey'),
    secretAccessKey: config.get('aws.accessSecretKey'),
  });
  const uploadFile = async (buffer, name, type) => {
    try {
      console.log(config.get('aws.accessKey'));
      console.log(config.get('aws.accessSecretKey'));
      console.log(config.get('aws.s3.storageBucketName'));
      const params = {
        ACL: 'public-read',
        Body: buffer,
        Bucket: config.get('aws.s3.storageBucketName'),
        ContentType: type.mime,
        Key: `${name}.${type.ext}`,
      };
      const url = await s3.getSignedUrlPromise('putObject', params);
      return s3.upload(params, url).promise();
    } catch (err) {
      console.log(err);
      return err;
    }
  };

  // function for uploading invoice pdf
  const uploadPdf = async (buffer, name, type) => {
    console.log(config.get('aws.s3.storageBucketName'));
    const params = {
      ACL: 'public-read',
      Body: buffer,
      Bucket: config.get('aws.s3.storageBucketName'),
      // ContentType: 'application/pdf',
      Key: `${name}.${type.ext}`,
      ContentDisposition: 'attachment; filename=file.pdf', // don't ever remove this line
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    return s3.upload(params, url).promise();
  };
  // post request to signup user
  router.post('/signup', async (req, res) => {
    const { ...body } = req.body;
    const { isValid } = checkIfEmpty(body.name, body.company, body.employees, body.email, body.password);
    try {
      if (isValid) {
        const company = body.company.replace(/ /g, '').toLowerCase();
        const companyExists = await DB.select('organizations', { name: company });
        if (!companyExists.length) {
          const hashedPassword = await hashPassword(body.password);
          if (hashedPassword) {
            const data = {
              name: company,
            };
            const saveData = await DB.insert('organizations', data);

            body.encrypted_password = hashedPassword;
            const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
            body.verificationhex = hash;

            if (body.phone === '') {
              body.phone = null;
            }
            const userData = {
              organizationId: saveData,
              fullname: body.name,
              encrypted_password: body.encrypted_password,
              email: body.email,
              phone: body.phone,
              verificationhex: body.verificationhex,
            };
            await DB.insert('users', userData);
            const confirmationUrl = frontendUrl(company, '/', {
              token: userData.verificationhex,
            });

            sgMail.setApiKey(config.get('mailing.sendgrid.apiKey'));
            const msg = {
              from: config.get('mailing.from'),
              templateId: config.get('mailing.sendgrid.templates.en.accountConfirmation'),
              personalizations: [
                {
                  to: [
                    {
                      email: userData.email,
                    },
                  ],
                  dynamic_template_data: {
                    receipt: true,
                    confirmation_url: confirmationUrl,
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
          } else {
            res.send({
              code: 400,
              msg: 'Some has error occured!',
            });
          }
        } else {
          res.send({
            code: 409,
            msg: 'Company already exists!',
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

  // serach company name and add on the subdomain
  router.post('/searchComapany', async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const company = body.company.replace(/ /g, '').toLowerCase();
      const companyExists = await DB.select('organizations', { name: company });
      if (companyExists.length > 0) {
        res.send({
          code: 200,
          msg: 'comapny found!',
        });
      } else {
        res.send({
          code: 404,
          msg: 'comapny not found!',
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

  // get request to verify user email
  router.get('/verify/:hex', async (req, res) => {
    try {
      const verificationhex = req.params.hex;
      // const isExist = await userModel.getOneBy({ verificationhex });
      const isExist = await DB.select('users', { verificationhex });
      if (isExist.length) {
        const updatedData = await DB.update('users', { isvalid: 1 }, { id: isExist[0].id });
        if (updatedData) {
          res.send({
            code: 200,
            msg: 'Email verified successfully.',
          });
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
      const { ...body } = req.body;
      console.log(body);
      const { isValid } = checkIfEmpty(body);
      if (isValid) {
        // finding user with email and company name
        const companyData = await DB.select('organizations', { name: body.company });
        const isUserExists = await DB.select('users', { email: body.email, organizationId: companyData[0].id });
        console.log('isUserExists', isUserExists);
        let subUser;
        if (!isUserExists.phone) {
          subUser = await DB.select('team', { email: body.email });
        }
        if (isUserExists.length) {
          if (isUserExists[0].isvalid === 0) {
            res.send({
              code: 403,
              msg: 'This email is not verified',
            });
          } else {
            const isPasswordValid = await verifyHash(body.password, isUserExists[0].encrypted_password);
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
                subUser,
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
            msg: 'Company name or Email is Invalid!',
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

  router.post('/resetpassword', async (req, res) => {
    try {
      const { isValid } = checkIfEmpty(req.body);
      const { email, company } = req.body;
      if (isValid) {
        const userData = await DB.select('users', { email });
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
            const url = frontendUrl(company, '/reset', {
              hh: forgetPassHex,
            });

            sgMail.setApiKey(config.get('mailing.sendgrid.apiKey'));
            const msg = {
              from: config.get('mailing.from'),
              templateId: config.get('mailing.sendgrid.templates.en. userResetPassword'),
              personalizations: [
                {
                  to: [
                    {
                      email,
                    },
                  ],
                  dynamic_template_data: {
                    receipt: true,
                    first_name: userData[0].fname,
                    change_password_url: url,
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
                  msg: 'Please check your email for forget password link!',
                });
              }
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

  // API for check trial days
  router.post('/trialDays', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const user = await DB.select('users', { id: body.tokenData.userid });
      const diff = Math.abs(new Date() - user[0].created_at);
      let s = Math.floor(diff / 1000);
      let m = Math.floor(s / 60);
      s %= 60;
      let h = Math.floor(m / 60);
      m %= 60;
      const totalDays = Math.floor(h / 24);
      h %= 24;
      const remainingDays = 14 - totalDays;
      console.log(remainingDays);
      const [{ isOnTrial }] = user;
      if (remainingDays === 0) {
        await DB.update('users', { isTrialEnded: true }, { id: body.tokenData.userid });
      }
      res.send({
        code: 200,
        remainingDays,
        isOnTrial,
      });
    } catch (err) {
      res.send({
        code: 444,
        msg: 'some error occurred!',
      });
    }
  });

  // API for getting exchange rate from DB
  router.post('/getRate', userAuthCheck, async (req, res) => {
    try {
      const rates = await DB.select('exchangeRate', {});
      res.send({
        code: 200,
        rates,
      });
    } catch (error) {
      res.send({
        code: 444,
        msg: 'Some error occurred!',
      });
    }
  });

  // post request to add property
  router.post('/addProperty', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const propertyData = {
        userId: id,
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

      const propertyExist = await DB.select('property', { userId: id, propertyNo: body.propertyNo });
      if (propertyExist.length) {
        await DB.update('property', propertyData, {
          userId: id,
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
      let propertiesData;
      if (!body.affiliateId) {
        propertiesData = await DB.select('property', { userId: body.tokenData.userid });
        each(
          propertiesData,
          async (items, next) => {
            const itemsCopy = items;
            const data = await DB.select('unitType', { propertyId: items.id });
            const data2 = await DB.select('unit', { propertyId: items.id });
            itemsCopy.noUnitType = data.length;
            itemsCopy.noUnit = data2.length;
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
      } else {
        propertiesData = await DB.select('property', { userId: body.affiliateId });
        each(
          propertiesData,
          async (items, next) => {
            const itemsCopy = items;
            const data = await DB.select('unitType', { propertyId: items.id });
            const data2 = await DB.select('unit', { propertyId: items.id });
            itemsCopy.noUnitType = data.length;
            itemsCopy.noUnit = data2.length;
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
      }
      console.log(propertiesData);
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
      let id;
      if (body.groupname) {
        start = Date.parse(body.groupname[0].split('T', 1));
        end = Date.parse(body.groupname[1].split('T', 1));
      }
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const unitTypeData = {
        userId: id,
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
      const units = await DB.select('unit', { userId: body.tokenData.userid });
      if (unittypeData) {
        res.send({
          code: 200,
          unittypeData,
          units,
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
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const unitData = {
        userId: id,
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
      const unitData = await DB.select('unit', { propertyId: body.propertyId });
      const data0 = await DB.selectCol(['units'], 'subscription', { userId: body.tokenData.userid });
      const data1 = await DB.selectCol(['isOnTrial'], 'users', { id: body.tokenData.userid });
      let units;
      if (data0 && data0.length > 0) {
        units = data0[0].units;
      }
      console.log('shsfts', units);
      const [{ isOnTrial }] = data1;
      res.send({
        code: 200,
        unitData,
        units,
        isOnTrial,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for getting total number of units by user
  router.post('/getTotalUnit', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unitData = await DB.select('unit', { userId: body.tokenData.userid });
      const data0 = await DB.selectCol(['units'], 'subscription', { userId: body.tokenData.userid });
      if (unitData.length || data0) {
        const totalUnit = unitData.length;
        let units;
        if (data0 && data0.length > 0) {
          units = data0[0].units;
        }
        console.log(totalUnit);
        console.log(units);
        res.send({
          code: 200,
          totalUnit,
          units,
        });
      } else {
        res.send({
          code: 404,
          msg: 'units not found',
        });
      }
    } catch (error) {
      console.log(error);
      res.send({
        code: 444,
        msg: error,
      });
    }
  });

  router.post('/addGroup', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      let prevCheckDate;
      let nextCheckDate;
      if (body.prevCheck || body.nextCheck) {
        prevCheckDate = body.prevCheck.split('T', 1);
        nextCheckDate = body.nextCheck.split('T', 1);
      }
      const groupData = {
        userId: body.tokenData.userid,
        groupName: body.groupname,
        checkCount: body.count,
        checkInterval: body.interval,
        prevCheck: prevCheckDate,
        nextCheck: nextCheckDate,
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
        groupId: body.groupId,
        taskName: body.taskName,
        note: body.note,
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
      const { ...body } = req.body;
      const taskDetail = await DB.select('task', { groupId: body.groupId });
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
        propertyId: body.property,
        propertyName: body.propertyName,
        unitId: body.unit,
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
      console.log('booking data', bookingData);
      const Id = await DB.insert('booking', bookingData);
      console.log('ID', Id);
      body.guestData.map(async (el) => {
        const Data = {
          userId: id,
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
          userId: id,
          bookingId: Id,
          serviceName: el.serviceName,
          servicePrice: el.servicePrice,
          quantity: el.serviceQuantity,
          serviceTax: el.serviceTax,
          serviceAmount: el.serviceAmount,
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
      console.log('getBooking', body.affiliateId);
      const guestData = [];
      const serviceData = [];
      let bookingData;
      let unittypeData;
      if (!body.affiliateId) {
        bookingData = await DB.select('booking', { userId: body.tokenData.userid });
        unittypeData = await DB.select('unitType', { userId: body.tokenData.userid });
      } else {
        bookingData = await DB.select('booking', { userId: body.affiliateId });
        unittypeData = await DB.select('unitType', { userId: body.affiliateId });
      }
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
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const bookingDetail = await DB.select('booking', { id: body.id, userId: id });
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
        await DB.update('booking', bookingData, { id: body.id, userId: id });
        res.send({
          code: 200,
          msg: 'Booking change successfully!',
        });
      }
      if (body.guestData.length) {
        body.guestData.map(async (el) => {
          if (el.id) {
            const Data = {
              userId: id,
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
              userId: id,
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
              userId: id,
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
              userId: id,
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
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      let Dob = null;
      if (body.dob) {
        Dob = body.dob.split('T', 1);
      }
      const guestData = {
        userId: id,
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
      console.log('addReservation', body);
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const reservationData = {
        userId: id,
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

      const Id = await DB.insert('reservation', reservationData);
      console.log('ID', Id);
      body.guestData.map(async (el) => {
        const Data = {
          userId: id,
          reservationId: Id,
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
      const reservationData = await DB.select('reservation', { userId: id });
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
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const unitType = await DB.select('unitType', { userId: id });
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

  // API for downloding invoice

  router.post('/downloadinvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      pdf.create(invoiceTemplate(body),
        { timeout: '100000' }).toFile(`
        ${__dirname}../../../../invoicepdf/${body.clientName}.pdf`, async (err, success) => {
        if (err) {
          console.log(err);
        }
        console.log('filepath', success);
        // success.filename is saved file path
        const buffer = fs.readFileSync(success.filename);
        const type = await fileType.fromBuffer(buffer);
        const fileName = `bucketFolder/${req.body.clientName}`;
        const hash = crypto.createHash('md5').update(fileName).digest('hex');
        // upload to AWS S3 bucket
        const data = await uploadPdf(buffer, hash, type);
        console.log('s3 response', data);
        // data.Location is uploaded url
        // this will remove pdf file after it is uploaded
        fs.unlinkSync(success.filename);
        res.send({
          code: 200,
          msg: 'Successfully downloaded invoice',
          url: data.Location,
        });
      });
    } catch (err) {
      res.send({
        code: 444,
        msg: err.msg,
      });
    }
  });

  // API for issue invoice and draft invoice
  router.post('/invoicedraft', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('invoice draft body', req.body);
      pdf
        .create(invoiceTemplate(body), { timeout: '100000' })
        .toFile(`${__dirname}../../../../invoicepdf/${body.clientName}.pdf`, async (err, success) => {
          if (err) {
            console.log(err);
          }
          console.log('filepath', success);
          // success.filename is saved file path
          const buffer = fs.readFileSync(success.filename);
          const type = await fileType.fromBuffer(buffer);
          const fileName = `bucketFolder/${req.body.clientName}`;
          const hash = crypto.createHash('md5').update(fileName).digest('hex');
          // upload to AWS S3 bucket
          const data = await uploadPdf(buffer, hash, type);
          console.log('s3 response', data);
          // data.Location is uploaded url
          // this will remove pdf file after it is uploaded
          fs.unlinkSync(success.filename);
          let id;
          if (!body.affiliateId) {
            id = body.tokenData.userid;
          } else {
            id = body.affiliateId;
          }
          const invoiceData = {
            userId: id,
            propertyId: body.propertyId,
            label: body.label,
            date: body.date,
            time: body.time,
            deliveryDate: body.deliveryDate,
            dueDate: body.dueDate,
            paymentType: body.paymentType,
            clientName: body.clientName,
            email: body.email,
            address: body.address,
            vat: body.vat,
            total: body.total,
            impression: body.impression,
            pdfurl: data.Location,
            status: body.status,
            type: body.type,
          };
          const Id = await DB.insert('invoice', invoiceData);
          console.log('invoice id', Id);
          body.itemData.map(async (el) => {
            const Data = {
              invoiceId: Id,
              itemDescription: el.itemDescription,
              quantity: el.quantity,
              price: el.price,
              amount: el.amount,
              discount: el.discount,
              discountPer: el.discountPer,
              itemTotal: el.itemTotal,
            };
            await DB.insert('invoiceItems', Data);
          });
          if (body.deleteInvoiceItemId) {
            await DB.remove('invoiceItems', { id: body.deleteInvoiceItemId });
          }
          res.send({
            code: 200,
            msg: 'Successfully drafted invoice',
            url: data.Location,
          });
        });
    } catch (err) {
      console.log(err);
      res.send({
        code: 444,
        msg: 'some error occurred',
      });
    }
  });

  // API for get invoice
  router.post('/getInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const invoiceData = await DB.select('invoice', { userId: id });
      const invoiceItems = [];
      each(
        invoiceData,
        async (items, next) => {
          const data = await DB.select('invoiceItems', { invoiceId: items.id });
          if (data.length) {
            invoiceItems.push(data);
          }

          next();
        },
        () => {
          if (invoiceData.length !== 0) {
            res.send({
              code: 200,
              invoiceData,
              invoiceItems,
            });
          } else {
            res.send({
              code: 404,
            });
          }
        },
      );
    } catch (err) {
      res.send({
        code: 444,
        msg: err,
      });
    }
  });
  // API for delete invoice
  router.post('/deleteInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const invoiceId = body.deleteId;
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

  // API for cancellation invoice
  router.post('/cancelInvoice', userAuthCheck, async (req, res) => {
    try {
      console.log('cancel invoice api hitting');
      const { ...body } = req.body;
      const invoiceId = body.id;
      const invoiceData = {
        type: body.type,
      };
      console.log('cancel invoice id', invoiceId);
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
      console.log('api called');
      const { ...body } = req.body;
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      // const userExists = await userModel.getOneBy({
      //   email: body.email,
      // });
      const userExists = await DB.select('users', { email: body.email });
      if (!userExists.length) {
        const password = randomstring.generate(7);
        console.log('password', password);
        const hashedPassword = await hashPassword(password);
        const teamData = {
          userId: id,
          email: body.email,
          role: body.role,
          bookingRead: body.bookingRead,
          bookingWrite: body.bookingWrite,
          calendarRead: body.calendarRead,
          calendarWrite: body.calendarWrite,
          propertiesRead: body.propertiesRead,
          propertiesWrite: body.propertiesWrite,
          guestsRead: body.guestsRead,
          guestsWrite: body.guestsWrite,
          serviceRead: body.serviceRead,
          serviceWrite: body.serviceWrite,
          teamRead: body.teamRead,
          teamWrite: body.teamWrite,
          invoicesRead: body.invoicesRead,
          invoicesWrite: body.invoicesWrite,
          statsRead: body.statsRead,
          statsWrite: body.statsWrite,
          ownerRead: body.ownerRead,
          ownerWrite: body.ownerWrite,
          billingRead: body.billingRead,
          billingWrite: body.billingWrite,
        };
        if (body.id) {
          await DB.update('team', teamData, { id: body.id });
          res.send({
            code: 200,
            msg: 'Data update successfully!',
          });
        } else {
          const companyData = await DB.select('organizations', { name: body.company });
          await DB.insert('team', teamData);
          const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
          const userData = {
            organizationId: companyData[0].id,
            email: body.email,
            verificationhex: hash,
            encrypted_password: hashedPassword,
          };
          await DB.insert('users', userData);

          const url = frontendUrl(body.company, '/', {
            token: userData.verificationhex,
          });

          const msg = {
            from: config.get('mailing.from'),
            templateId: config.get('mailing.sendgrid.templates.en.subUserConfirmation'),
            personalizations: [
              {
                to: [
                  {
                    email: body.email,
                  },
                ],
                dynamic_template_data: {
                  receipt: true,
                  role: body.role,
                  password,
                  link: url,
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
  // API for update sub userv details
  router.post('/updateSubUser', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const subUserData = {
        userId: id,
        email: body.email,
        role: body.role,
        bookingRead: body.bookingRead,
        bookingWrite: body.bookingWrite,
        calendarRead: body.calendarRead,
        calendarWrite: body.calendarWrite,
        propertiesRead: body.propertiesRead,
        propertiesWrite: body.propertiesWrite,
        guestsRead: body.guestsRead,
        guestsWrite: body.guestsWrite,
        serviceRead: body.serviceRead,
        serviceWrite: body.serviceWrite,
        teamRead: body.teamRead,
        teamWrite: body.teamWrite,
        invoicesRead: body.invoicesRead,
        invoicesWrite: body.invoicesWrite,
        statsRead: body.statsRead,
        statsWrite: body.statsWrite,
      };
      console.log(subUserData);
      await DB.update('team', subUserData, { id: body.id });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
      });
    } catch (err) {
      console.log(err);
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
      console.log('getsubuser', body);
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const subUser = await DB.select('team', { userId: id });
      console.log('subuser', subUser);
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

  // API for delete subuser
  router.post('/deleteSubUser', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('Delete sub user id', req.body);
      const user = await DB.selectCol(['email'], 'team', { id: body.deleteId });
      console.log(user);
      const [{ email }] = user;
      console.log('email', email);
      await DB.remove('team', { id: body.deleteId });
      await DB.remove('users', { email });
      res.send({
        code: 200,
        msg: 'Sub User removed successfully!',
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
    console.log(body.properties);
    try {
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      let Dob = null;
      if (body.dob) {
        Dob = body.dob.split('T', 1);
      }
      const ownerData = {
        userId: id,
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
        const password = randomstring.generate(7);
        const hashedPassword = await hashPassword(password);
        const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
        ownerData.verificationhex = hash;
        ownerData.encrypted_password = hashedPassword;
        const saveData = await DB.insert('owner', ownerData);
        each(body.properties, async (items, next) => {
          await DB.update('property', { ownerId: saveData }, { id: items });
          next();
        });

        const msg = {
          from: config.get('mailing.from'),
          templateId: config.get('mailing.sendgrid.templates.en.ownerConfirmation'),
          personalizations: [
            {
              to: [
                {
                  email: ownerData.email,
                },
              ],
              dynamic_template_data: {
                receipt: true,
                password,
                link: config.get('ownerFrontend.endpoint'),
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
              msg: 'Data saved successfully!',
            });
          }
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
  router.post('/getOwner', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }
      const data = await DB.select('owner', { userId: id });
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
      let Id;
      if (!body.affiliateId) {
        console.log('no affiliaate id');
        Id = body.tokenData.userid;
      } else {
        console.log('affiliate id');
        Id = body.affiliateId;
      }
      const userInfo = await DB.select('users', { id: Id });
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
  router.post('/photo/:id', async (req, res) => {
    const form = new multiparty.Form();
    form.parse(req, async (error, fields, files) => {
      if (error) {
        console.log(error);
      }
      try {
        const { path } = files.file[0];
        const buffer = fs.readFileSync(path);
        console.log(buffer);
        const type = await fileType.fromBuffer(buffer);
        const timestamp = Date.now().toString();
        const fileName = `bucketFolder/${timestamp}-lg`;
        const hash = crypto.createHash('md5').update(fileName).digest('hex');
        const data = await uploadFile(buffer, hash, type);
        console.log('photo url', data.Location);
        const d0 = await DB.update('users', { image: data.Location }, { id: req.params.id });
        console.log(d0);
        return res.json({
          image: data.Location,
        });
      } catch (e) {
        console.log(e);
        res.send({
          code: 444,
          msg: 'Some error has occured!',
        });
      }
      return 0;
    });
  });

  // API for upload property picture
  router.post('/propertyPicture/:id', async (req, res) => {
    const form = new multiparty.Form();
    form.parse(req, async (error, fields, files) => {
      if (error) {
        console.log(error);
      }
      try {
        const { path } = files.file[0];
        const buffer = fs.readFileSync(path);
        const type = await fileType.fromBuffer(buffer);
        const timestamp = Date.now().toString();
        const fileName = `bucketFolder/${timestamp}-lg`;
        const data = await uploadFile(buffer, fileName, type);
        await DB.update('property', { image: data.Location }, { id: req.params.id });
        return res.json({
          image: data.Location,
        });
      } catch (e) {
        res.send({
          code: 444,
          msg: 'Some error has occured!',
        });
      }
      return 0;
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

  // API for change user password
  router.post('/changePassword', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userData = await DB.select('users', { id: body.tokenData.userid });
      const isPasswordValid = await verifyHash(body.oldPassword, userData[0].encrypted_password);
      if (isPasswordValid) {
        const hashedPassword = await hashPassword(body.newPassword);
        await DB.update('users', { encrypted_password: hashedPassword }, { id: body.tokenData.userid });
        res.send({
          code: 200,
          msg: 'Password change successfully!',
        });
      } else {
        res.send({
          code: 401,
          msg: 'Invalid Old Password!',
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

  // API for add personal Information
  router.post('/updatePersonalInfo', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userData = {
        fname: body.fname,
        lname: body.lname,
        address: body.address,
        email: body.email,
        phone: body.phone,
      };
      await DB.update('users', userData, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for updating organisation information
  router.post('/updateOrganisation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const companyData = {
        userId: body.tokenData.userid,
        name: body.name,
        address: body.address,
        country: body.country,
        state: body.state,
        city: body.city,
        zip: body.zip,
        vatid: body.vatId,
      };
      await DB.insert('organizations', companyData);
      res.send({
        code: 200,
        msg: 'Data saved successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API to get user info
  router.post('/getuserData', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userData = await DB.selectCol(['fname', 'lname', 'address', 'email', 'phone', 'image'], 'users', {
        id: body.tokenData.userid,
      });
      res.send({
        code: 200,
        userData,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get company info
  router.post('/getCompanyData', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const companyData = await DB.select('organizations', { id: body.tokenData.userid });
      res.send({
        code: 200,
        companyData,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get monthly revenue
  router.post('/getRevenue', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const currYear = new Date().getFullYear();
      const prevYear = new Date().getFullYear() - 1;
      const arr = [];
      const arr2 = [];
      const currYearArr = [];
      const prevYearArr = [];
      let revenueData;
      if (body.propertyId !== null) {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid, propertyId: body.propertyId });
      } else {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid });
      }

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear())
        .forEach((filter) => {
          arr.push(filter);
        });

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear() - 1)
        .forEach((filter) => {
          arr2.push(filter);
        });

      for (let i = 1; i <= 12; i += 1) {
        let sum = 0;
        let sum2 = 0;
        arr
          .filter((el) => el.startDate.getMonth() + 1 === i)
          .forEach((filter) => {
            sum += filter.totalAmount;
          });
        arr2
          .filter((el) => el.startDate.getMonth() + 1 === i)
          .forEach((filter) => {
            sum2 += filter.totalAmount;
          });
        currYearArr.push(sum);
        prevYearArr.push(sum2);
      }

      res.send({
        code: 200,
        currYear,
        prevYear,
        currYearArr,
        prevYearArr,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get occupancy report
  router.post('/getOccupancy', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const currYear = new Date().getFullYear();
      const prevYear = new Date().getFullYear() - 1;
      const arr = [];
      const arr2 = [];
      const currYearArr = [];
      const prevYearArr = [];
      let revenueData;
      if (body.propertyId !== null) {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid, propertyId: body.propertyId });
      } else {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid });
      }

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear())
        .forEach((filter) => {
          arr.push(filter);
        });

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear() - 1)
        .forEach((filter) => {
          arr2.push(filter);
        });

      for (let i = 1; i <= 12; i += 1) {
        let per = 0;
        let prevPer = 0;
        const count = [];
        const prevCount = [];
        arr.forEach((el) => {
          if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 === i) {
            count.push(((el.endDate - el.startDate) / (1000 * 3600 * 24) / 30) * 100);
          } else if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 !== i) {
            count.push(((30 - el.startDate.getDate()) / 30) * 100);
          } else if (el.startDate.getMonth() + 1 !== i && el.endDate.getMonth() + 1 === i) {
            count.push((el.endDate.getDate() / 30) * 100);
          } else if (el.startDate.getMonth() + 1 === i - 1 && el.endDate.getMonth() + 1 === i + 1) {
            count.push(100);
          }
        });
        if (count.length > 0) {
          per = count.reduce((a, b) => a + (b || 0), 0) / count.length;
          currYearArr.push(Math.round(per));
        } else {
          currYearArr.push(0);
        }

        arr2.forEach((el) => {
          if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 === i) {
            prevCount.push(((el.endDate - el.startDate) / (1000 * 3600 * 24) / 30) * 100);
          } else if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 !== i) {
            prevCount.push(((30 - el.startDate.getDate()) / 30) * 100);
          } else if (el.startDate.getMonth() + 1 !== i && el.endDate.getMonth() + 1 === i) {
            prevCount.push((el.endDate.getDate() / 30) * 100);
          } else if (el.startDate.getMonth() + 1 === i - 1 && el.endDate.getMonth() + 1 === i + 1) {
            prevCount.push(100);
          }
        });
        if (prevCount.length > 0) {
          prevPer = prevCount.reduce((a, b) => a + (b || 0), 0) / prevCount.length;
          prevYearArr.push(Math.round(prevPer));
        } else {
          prevYearArr.push(0);
        }
      }

      res.send({
        code: 200,
        currYear,
        prevYear,
        currYearArr,
        prevYearArr,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for get pace report
  router.post('/getPace', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const currYear = new Date().getFullYear();
      const prevYear = new Date().getFullYear() - 1;
      const arr = [];
      const arr2 = [];
      const currYearArr = [];
      const prevYearArr = [];
      let revenueData;
      if (body.propertyId !== null) {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid, propertyId: body.propertyId });
      } else {
        revenueData = await DB.select('booking', { userId: body.tokenData.userid });
      }

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear())
        .forEach((filter) => {
          arr.push(filter);
        });

      revenueData
        .filter((el) => el.startDate.getFullYear() === new Date().getFullYear() - 1)
        .forEach((filter) => {
          arr2.push(filter);
        });

      for (let i = 1; i <= 12; i += 1) {
        let avgCount = 0;
        let avgPrevCount = 0;
        const count = [];
        const prevCount = [];
        arr.forEach((el) => {
          if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 === i) {
            count.push((el.endDate - el.startDate) / (1000 * 3600 * 24));
          } else if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 !== i) {
            count.push(30 - el.startDate.getDate());
          } else if (el.startDate.getMonth() + 1 !== i && el.endDate.getMonth() + 1 === i) {
            count.push(el.endDate.getDate());
          } else if (el.startDate.getMonth() + 1 === i - 1 && el.endDate.getMonth() + 1 === i + 1) {
            count.push(30);
          }
        });
        if (count.length > 0) {
          avgCount = count.reduce((a, b) => a + (b || 0), 0) / count.length;
          currYearArr.push(Math.round(avgCount));
        } else {
          currYearArr.push(0);
        }

        arr2.forEach((el) => {
          if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 === i) {
            prevCount.push((el.endDate - el.startDate) / (1000 * 3600 * 24));
          } else if (el.startDate.getMonth() + 1 === i && el.endDate.getMonth() + 1 !== i) {
            prevCount.push(30 - el.startDate.getDate());
          } else if (el.startDate.getMonth() + 1 !== i && el.endDate.getMonth() + 1 === i) {
            prevCount.push(el.endDate.getDate());
          } else if (el.startDate.getMonth() + 1 === i - 1 && el.endDate.getMonth() + 1 === i + 1) {
            prevCount.push(30);
          }
        });
        if (prevCount.length > 0) {
          avgPrevCount = prevCount.reduce((a, b) => a + (b || 0), 0) / prevCount.length;
          prevYearArr.push(Math.round(avgPrevCount));
        } else {
          prevYearArr.push(0);
        }
      }

      res.send({
        code: 200,
        currYear,
        prevYear,
        currYearArr,
        prevYearArr,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API to get perCountry report
  router.post('/getCountryReport', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = await DB.select('guest', { userId: body.tokenData.userid });
      const country = [];
      const average = [];
      guestData.forEach((el, i, array) => {
        const checkexist = country.filter((name) => name === el.country);
        if (checkexist.length === 0) {
          const countrys = array.filter((ele) => el.country === ele.country);
          if (countrys.length > 0) {
            country.push(countrys[0].country);
            average.push(countrys.length);
          }
        }
      });
      res.send({
        code: 200,
        country,
        average,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // Billing related apis

  // API for creating produc and charging customer and activating subscription
  router.post('/charge', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('charge body', body);
      const {
        // stripeToken,
        amount,
        interval,
        noOfUnits,
        currency,
        planType,
      } = body;
      const data = await DB.selectCol(['email'], 'users', { id: req.body.tokenData.userid });
      const [{ email }] = data;
      const now = new Date();
      const nextdate = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      const nextMonth = nextdate / 1000;
      console.log(nextMonth, 'nextMonth');
      const customer = await stripe.customers.create({
        email,
        // source: stripeToken,
        metadata: { currency },
      });
      console.log('customer', customer);
      const product = await stripe.products.create({
        name: `Lodgly ${planType} Subscription`,
        type: 'service',
      });
      console.log('product', product);
      const plan = await stripe.plans.create({
        nickname: `${interval} plan`,
        amount: (Math.round(parseFloat(amount) * 100)),
        interval,
        product: product.id,
        currency: `${currency}`,
      });
      console.log('plan', plan);
      let subscriptionid;
      if (plan.interval === 'month') {
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [
            {
              plan: plan.id,
            },
          ],
          billing_cycle_anchor: nextMonth,
        });
        subscriptionid = subscription.id;
        console.log('subscription', subscription);
      } else {
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [
            {
              plan: plan.id,
            },
          ],
        });
        subscriptionid = subscription.id;
        console.log('subscription', subscription);
      }
      const subscriptionObject = {
        productId: product.id,
        planId: plan.id,
        customerId: customer.id,
        subscriptionId: subscriptionid,
        subscription: true,
        userId: body.tokenData.userid,
        units: noOfUnits,
        Amount: amount,
        interval: plan.interval,
        planType,
        currency,
      };
      console.log('subscription object', subscriptionObject);
      await DB.insert('subscription', subscriptionObject);
      await DB.update('users', { isSubscribed: true, isOnTrial: false }, { id: body.tokenData.userid });
      const id = await DB.insert('subscription', subscriptionObject);
      console.log(id);
      res.send({
        code: 200,
        msg: 'Transaction successfull',
      });
    } catch (err) {
      console.log(err);
      res.send({
        code: 444,
        msg: 'some error occurred!',
      });
    }
  });

  // API for getting transaction
  router.get('/transactions', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const transactions = await DB.select('subscription', { userId: body.tokenData.userid });
      const subscription = await stripe.subscriptions.retrieve(transactions[0].subscriptionId);
      console.log('subscription', subscription);
      const endDate = subscription.current_period_end * 1000;
      console.log(new Date(endDate));
      console.log(subscription);
      if (transactions && transactions.length) {
        res.send({
          code: 200,
          transactions,
          endDate,
        });
      } else {
        res.send({
          code: 444,
        });
      }
    } catch (error) {
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });
  router.post('/getBillingInvoice', userAuthCheck, async (req, res) => {
    try {
      const Data = await DB.select('subscription', { userId: req.body.tokenData.userid });
      const [{ customerId }] = Data;
      const invoicesList = [];
      await stripe.invoices.list({ customer: customerId }, (
        err,
        invoices,
      ) => {
        invoices.data.forEach((el) => {
          if (el.customer === customerId) {
            const { currency } = el;
            const amount = el.amount_paid / 100;
            // let amount = Math.floor(parseFloat(initial))
            // const { units } = Data[0];
            const start = new Date(
              el.lines.data[0].period.start * 1000,
            ).toDateString();
            const end = new Date(el.lines.data[0].period.end * 1001).toDateString();
            const dt = {
              invoiceId: el.id,
              start,
              end,
              amount,
              // units,
              currency,
              pdf: el.invoice_pdf,
            };
            invoicesList.push(dt);
          }
        });
        res.send({ code: 200, invoicesList });
      });
    } catch (e) {
      res.send({ code: 444, msg: 'Some error has occured.' });
    }
  });

  // API for cancelling subscription
  router.post('/cancelSubscription', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      stripe.subscriptions.del(body.subscriptionId, (err, confirmation) => {
        if (err) {
          console.log(err);
          res.send({
            code: 444,
            err,
          });
        }
        console.log(confirmation);
        res.send({
          code: 200,
          msg: 'Your bsubscription is cancelled',
        });
      });
    } catch (error) {
      console.log(error);
      res.send({
        code: 444,
        msg: 'some error occurred!',
      });
    }
  });

  // API for changing subscription
  router.post('/changeSubscription', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const {
        subscriptionId,
        amount,
        interval,
        noOfUnits,
        currency,
        planType,
      } = body;
      const Data = await DB.select('subscription', { userId: body.tokenData.userid });
      const product = await stripe.products.create({
        name: `Lodgly ${planType} Subscription`,
        type: 'service',
      });
      const updatePlan = await stripe.plans.create({
        nickname: `Lodgly ${planType} Subscription`,
        amount: Math.round(parseFloat(amount) * 100),
        interval,
        product: product.id,
        currency,
      });
      console.log('plan', updatePlan);
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const difference = amount - Data[0].Amount;
      if (difference > 0) {
        const charge = await stripe.charges.create({
          amount: Math.round(parseFloat(difference) * 100),
          currency,
          customer: subscription.customer,
          description: 'upgrading the plan',
        });
        console.log('charge', charge);
      }
      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
          items: [
            {
              id: subscription.items.data[0].id,
              plan: updatePlan.id,
            },
          ],
          proration_behavior: 'none',
        },
      );
      console.log('updated subscription', updatedSubscription);
      const payload = {
        subscriptionId: updatedSubscription.id,
        planId: updatedSubscription.plan.id,
        productId: updatedSubscription.plan.product,
        units: noOfUnits,
        interval,
        planType,
        amount,
      };
      const id = await DB.update('subscription', payload, { userId: body.tokenData.userid });
      console.log(id);
      res.send({
        code: 200,
        msg: 'your plan is successfully changed',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for getting subscription status and updating the databse accordingly
  router.get('/getSubscriptionStatus', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const Data = await DB.selectCol(['subscriptionId'], 'subscription', { userId: body.tokenData.userid });
      const [{ subscriptionId }] = Data;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log('active subscription', subscription);
      if (subscription) {
        const now = new Date();
        const endDate = new Date(subscription.current_period_end * 1000);
        if (now > endDate) {
          await DB.update('users', { issubscriptionEnded: true }, { id: body.tokenData.userid });
        }
      }
      res.send({
        code: 200,
        msg: 'subscription status updated',
      });
    } catch (error) {
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // getting subscribed status of user
  router.get('/getUserSubscriptionStatus', userAuthCheck, async (req, res) => {
    try {
      const { userid } = req.body.tokenData;
      const userSubsDetails = await DB.selectCol(['isSubscribed',
        'isOnTrial', 'issubscriptionEnded', 'created_at'], 'users', { id: userid });
      console.log(userSubsDetails);
      const diff = Math.abs(new Date() - userSubsDetails[0].created_at);
      let s = Math.floor(diff / 1000);
      let m = Math.floor(s / 60);
      s %= 60;
      let h = Math.floor(m / 60);
      m %= 60;
      const totalDays = Math.floor(h / 24);
      h %= 24;
      const remainingDays = 14 - totalDays;
      userSubsDetails[0].days = remainingDays;
      res.send({
        code: 200,
        userSubsDetails,
      });
    } catch (error) {
      console.log(error);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for put data in Calendar
  router.post('/fetchCalendar', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const propertyData = await DB.select('property', { userId: body.tokenData.userid });
      const unitType = [];
      const unit = [];
      each(
        propertyData,
        async (items, next) => {
          const itemsCopy = items;
          unitType.push(await DB.select('unitType', { propertyId: items.id }));
          unit.push(await DB.select('unit', { propertyId: items.id }));
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            propertyData,
            unitType,
            unit,
          });
        },
      );
    } catch (e) {
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
      console.log(body);
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
      await DB.update('booking', { status: body.status, statusColour: colour }, { id: body.bookingId });
      res.send({
        code: 200,
        msg: 'Status added successfully!',
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  return router;
};

module.exports = usersRouter;
