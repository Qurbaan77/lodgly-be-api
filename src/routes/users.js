const express = require('express');
const config = require('config');
const crypto = require('crypto');
const randomstring = require('randomstring');
const moment = require('moment');
const nodemailer = require('nodemailer');
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
const { frontendUrl, ownerPanelUrl } = require('../functions/frontend');
const { userAuthCheck } = require('../middlewares/middlewares');
const invoiceTemplate = require('../invoiceTemplate/invoiceTemplate');
const sentryCapture = require('../../config/sentryCapture');

AWS.config.setPromisesDependency(bluebird);
AWS.config.update({ region: 'eu-west-1' });

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

  const uploadFile = async (buffer, name, type, organizationid) => {
    try {
      const bucket = config.get('aws.s3.storageBucketName');
      const params = {
        ACL: 'public-read',
        Body: buffer,
        Bucket: `${bucket}/${organizationid}/photos`,
        ContentType: type.mime,
        Key: `${name}.${type.ext}`,
      };
      const url = await s3.getSignedUrlPromise('putObject', params);
      return s3.upload(params, url).promise();
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      return e;
    }
  };

  // function for uploading invoice pdf
  const uploadPdf = async (buffer, name, type, organizationid) => {
    const bucket = config.get('aws.s3.storageBucketName');
    const params = {
      ACL: 'public-read',
      Body: buffer,
      Bucket: `${bucket}/${organizationid}/invoices`,
      // ContentType: 'application/pdf',
      Key: `${name}.${type.ext}`,
      ContentDisposition: 'attachment; filename=file.pdf', // don't ever remove this line
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    return s3.upload(params, url).promise();
  };

  // post request to signup user
  router.post('/request-access', async ({
    body: {
      email, phone, name, propertiesCount,
    },
  }, res) => {
    try {
      if (email && phone && name && propertiesCount) {
        const message = [
          `Name: ${name}`,
          `E-mail: ${email}`,
          `Phone: ${phone}`,
          `Properties No.: ${propertiesCount}`,
        ];

        const transporter = nodemailer.createTransport({
          SES: new AWS.SES({
            apiVersion: '2010-12-01',
            accessKeyId: config.get('aws.accessKey'),
            secretAccessKey: config.get('aws.accessSecretKey'),
          }),
        });

        transporter.sendMail({
          from: 'no-reply@lodgly.com',
          to: 'mits87@gmail.com',
          subject: `[${config.get('environment')}] New Lodgly Signup Request`,
          text: message.join('\n'),
          html: message.join('<br/>'),
        }, (err, { envelope, messageId }) => {
          console.log('SES: ', { envelope, messageId, err });
          res.send({
            code: 200,
            msg: 'Request sent succesfully! We will contant with you soon!',
          });
        });
      } else {
        res.send({
          code: 400,
          msg: 'Invalid data',
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 400,
        msg: 'Some error has occured!',
      });
    }
  });

  // post request to signup user
  router.post('/signup', async (req, res) => {
    const { ...body } = req.body;
    console.log(body);
    const { isValid } = checkIfEmpty(body.name, body.company, body.email, body.password, body.coupon);
    try {
      if (isValid) {
        const company = body.company.replace(/ /g, '').toLowerCase();
        const companyExists = await DB.select('organizations', { name: company });
        if (!companyExists.length) {
          let isOnTrial = true;
          let isSubscribed = false;
          if (body.coupon && body.coupon !== 'undefined') {
            const couponData = await DB.select('coupons', { coupon: body.coupon });
            if (couponData.length && couponData[0].isUsed === 0) {
              isOnTrial = false;
              isSubscribed = true;
              const hashedPassword = await hashPassword(body.password);
              if (hashedPassword) {
                const data = {
                  name: company,
                  planType: 'basic',
                };
                const saveData = await DB.insert('organizations', data);

                body.encrypted_password = hashedPassword;
                const hash = crypto.createHmac('sha256', 'verificationHash').update(body.company).digest('hex');
                body.verificationhex = hash;

                if (body.phone === '') {
                  body.phone = null;
                }
                const userData = {
                  organizationId: saveData,
                  fullname: body.name,
                  companyName: body.company,
                  encrypted_password: body.encrypted_password,
                  email: body.email,
                  phone: body.phone,
                  isOnTrial,
                  isSubscribed,
                  verificationhex: body.verificationhex,
                  timeZone: body.timeZone,
                };
                await DB.insert('users', userData);

                const featureData = {
                  organizationId: saveData,
                  follow: 'advance',
                };
                await DB.insert('feature', featureData);
                const confirmationUrl = frontendUrl(company, '/', {
                  token: userData.verificationhex,
                });

                // const confirmationUrl = `http://${company}.localhost:3000/?token=${userData.verificationhex}`;

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
                        username: userData.fullname,
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
                msg: 'Invalid Coupon!',
              });
            }
          } else {
            const hashedPassword = await hashPassword(body.password);
            if (hashedPassword) {
              const data = {
                name: company,
                planType: 'advance',
              };
              const saveData = await DB.insert('organizations', data);

              body.encrypted_password = hashedPassword;
              const hash = crypto.createHmac('sha256', 'verificationHash').update(body.company).digest('hex');
              body.verificationhex = hash;

              if (body.phone === '') {
                body.phone = null;
              }
              const userData = {
                organizationId: saveData,
                fullname: body.name,
                companyName: body.company,
                encrypted_password: body.encrypted_password,
                email: body.email,
                phone: body.phone,
                isOnTrial,
                isSubscribed,
                verificationhex: body.verificationhex,
              };
              await DB.insert('users', userData);

              const featureData = {
                organizationId: saveData,
                follow: 'advance',
              };
              await DB.insert('feature', featureData);
              const confirmationUrl = frontendUrl(company, '/', {
                token: userData.verificationhex,
              });

              // const confirmationUrl = `http://${company}.localhost:3000/?token=${userData.verificationhex}`;

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
                      username: userData.fullname,
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
      sentryCapture(e);
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
      const companyExists = await DB.select('organizations', { name: body.companyName });
      console.log(companyExists);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
              const token = signJwt(isUserExists[0].id, companyData[0].id);
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
      sentryCapture(e);
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
    try {
      const { newpassword, hex } = req.body;
      const { isValid } = checkIfEmpty(req.body);
      if (isValid) {
        const userData = await DB.select('users', { forgetPassHex: hex });
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
                forgetPassHex: hex,
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
      sentryCapture(e);
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
        const companyData = await DB.selectCol(['id'], 'organizations', { name: company });
        const organizationId = companyData[0].id;
        const userData = await DB.select('users', { email });
        if (userData.length && companyData) {
          const forgetPassHex = crypto.createHmac('sha256', 'forgetPasswordHex').update(company).digest('hex');
          const updatedData = await DB.update(
            'users',
            {
              forgetPassHex,
            },
            {
              email,
              organizationId,
            },
          );

          if (updatedData) {
            const url = frontendUrl(company, '/reset', {
              hh: forgetPassHex,
            });
            // const url = `http://${company}.localhost:3000/reset?hh=${forgetPassHex}`;

            sgMail.setApiKey(config.get('mailing.sendgrid.apiKey'));
            const msg = {
              from: config.get('mailing.from'),
              templateId: config.get('mailing.sendgrid.templates.en.userResetPassword'),
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
      sentryCapture(e);
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
      sentryCapture(e);
      console.log('error', e);
      res.send({ code: 444, msg: 'Some error has occured.' });
    }
  });

  // Post API for adding plans detail
  router.post('/addPlan', async (req, res) => {
    try {
      const { ...body } = req.body;
      const planData = {
        planType: body.planType,
        booking: body.booking,
        calendar: body.calendar,
        properties: body.properties,
        team: body.team,
        invoice: body.invoice,
        stats: body.stats,
        owner: body.owner,
        websideBuilder: body.websideBuilder,
        channelManager: body.channelManager,
      };
      await DB.insert('plan', planData);
      res.send({
        code: 200,
        msg: 'Data add sucessfully',
      });
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({ code: 444, msg: 'Some error has occured.' });
    }
  });

  // get request for geting feature data
  router.post('/getFeature', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('feature body', body);
      // let id;
      // if (body.affiliateId) {
      //   id = body.affiliateId;
      // } else {
      //   id = body.tokenData.organizationid;
      // }
      let featureData;
      const featureTable = await DB.select('feature', { organizationId: body.tokenData.organizationid });
      console.log('feature table', featureTable);
      const [{ follow }] = featureTable;
      if (follow === 'advance') {
        const advancePlan = await DB.select('plan', { planType: 'advance' });
        featureData = advancePlan;
      } else if (follow === 'basic') {
        const basicPlan = await DB.select('plan', { planType: 'basic' });
        featureData = basicPlan;
      } else {
        featureData = featureTable;
      }
      res.send({
        code: 200,
        featureData,
      });
      // const organizationPlan = await DB.selectCol(['planType'], 'organizations', { id });
      // if (organizationPlan && organizationPlan.length) {
      //   const [{ planType }] = organizationPlan;
      //   if (planType === 'basic') {
      //     const data0 = await DB.select('plan', { planType });
      //     const data1 = await DB.select('feature', { organizationId: id });
      //     console.log('data from feature', data0);
      //     console.log('data from plan', data1);
      //     const webPerm = data1[0].websideBuilder;
      //     const chanPerm = data1[0].channelManager;
      //     if (webPerm || chanPerm) {
      //       const featureData = data1;
      //       res.send({
      //         code: 200,
      //         featureData,
      //       });
      //     } else {
      //       const featureData = data0;
      //       res.send({
      //         code: 200,
      //         featureData,
      //       });
      //     }
      //   } else {
      //     const data = await DB.select('plan', { planType });
      //     const featureData = data;
      //     res.send({
      //       code: 200,
      //       featureData,
      //     });
      //   }
      // }
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured.',
      });
    }
  });

  // API for checking trial days
  router.post('/trialDays', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const user = await DB.select('users', { id });
      if (user && user.length > 0) {
        const [{ trialEnded, created_at: createdAt }] = user;
        let diff;
        if (trialEnded) {
          diff = Math.abs(new Date() - trialEnded);
        } else {
          diff = Math.abs(new Date() - createdAt);
        }
        let s = Math.floor(diff / 1000);
        let m = Math.floor(s / 60);
        s %= 60;
        let h = Math.floor(m / 60);
        m %= 60;
        const totalDays = Math.floor(h / 24);
        h %= 24;
        const remainingDays = trialEnded ? totalDays : config.get('TRIAL_DAYS') - totalDays;
        const [{ isOnTrial }] = user;
        if (remainingDays <= 0) {
          if (user && user[0].trialEnded) {
            await DB.update('users',
              { isOnTrial: true }, { id: body.tokenData.userid });
          } else {
            await DB.update('users',
              {
                isOnTrial: true,
                trialEnded: moment().utc().format('YYYY-MM-DD hh:mm:ss'),
              }, { id: body.tokenData.userid });
          }
        }
        res.send({
          code: 200,
          remainingDays,
          isOnTrial,
        });
      }
    } catch (e) {
      console.log(e);
      sentryCapture(e);
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
    } catch (e) {
      sentryCapture(e);
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
        propertyName: body.propertyName,
      };
      const savedData = await DB.insert('propertyV2', propertyData);
      const unitTypeData = {
        userId: id,
        propertyId: savedData,
        unitTypeName: body.propertyName,
      };
      // creating unit type with same name
      const unitTypeV2Id = await DB.insert('unitTypeV2', unitTypeData);
      res.send({
        code: 200,
        savedData,
        unitTypeV2Id,
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!.',
      });
    }
  });

  // post request to add property
  // router.post('/addProperty', userAuthCheck, async (req, res) => {
  //   try {
  //     const { ...body } = req.body;
  //     let id;
  //     if (body.affiliateId) {
  //       id = body.affiliateId;
  //     } else {
  //       id = body.tokenData.userid;
  //     }
  //     const propertyData = {
  //       userId: id,
  //       propertyNo: body.propertyNo,
  //       propertyName: body.propertyName,
  //       propertyType: body.propertyType,
  //       address: body.address,
  //       country: body.country,
  //       state: body.state,
  //       city: body.city,
  //       zip: body.zip,
  //       website: body.website,

  //       bedrooms: body.bedrooms,
  //       fullBathroom: body.fullBathroom,
  //       halfBathroom: body.halfBathroom,
  //       sqfoot: body.sqfoot,
  //       description: body.description,
  //     };

  //     const propertyExist = await DB.select('property', { userId: id, propertyNo: body.propertyNo });
  //     if (propertyExist.length) {
  //       await DB.update('property', propertyData, {
  //         userId: id,
  //         propertyNo: body.propertyNo,
  //       });
  //       res.send({
  //         code: 200,
  //         msg: 'Data Update Successfully!',
  //       });
  //     } else {
  //       const saveProperty = await DB.insert('property', propertyData);
  //       const unitTypeData = {
  //         userId: id,
  //         propertyId: saveProperty,
  //         unitTypeName: body.propertyName,
  //       };
  //       const saveUnitType = await DB.insert('unitType', unitTypeData);
  //       const unitData = {
  //         userId: id,
  //         propertyId: saveProperty,
  //         unittypeId: saveUnitType,
  //         unitName: body.propertyName,
  //       };
  //       await DB.insert('unit', unitData);
  //       res.send({
  //         code: 200,
  //         msg: 'Data Saved Successfully!',
  //       });
  //     }
  //   } catch (e) {
  //     console.log(e);
  //     res.send({
  //       code: 444,
  //       msg: 'Some error has occured!.',
  //     });
  //   }
  // });

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
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for getting property name
  router.post('/getPropertyName', userAuthCheck, async (req, res) => {
    const propertyName = await DB.selectCol(['propertyName'], 'propertyV2', { id: req.body.propertyId });
    if (propertyName) {
      res.send({
        code: 200,
        propertyName,
      });
    } else {
      res.send({
        code: 404,
        msg: 'Property Does not exist',
      });
    }
  });

  router.post('/fetchProperty', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const propertiesData = await DB.select('propertyV2', { userId: id });
      each(
        propertiesData,
        async (items, next) => {
          const itemsCopy = items;
          const data = await DB.select('unitTypeV2', { propertyId: items.id });
          itemsCopy.unitType = data;
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
      console.log(propertiesData);
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // router.post('/fetchProperty', userAuthCheck, async (req, res) => {
  //   try {
  //     const { ...body } = req.body;
  //     let propertiesData;
  //     if (!body.affiliateId) {
  //       propertiesData = await DB.select('property', { userId: body.tokenData.userid });
  //       each(
  //         propertiesData,
  //         async (items, next) => {
  //           const itemsCopy = items;
  //           const data = await DB.select('unitType', { propertyId: items.id });
  //           const data2 = await DB.select('unit', { propertyId: items.id });
  //           itemsCopy.noUnitType = data.length;
  //           itemsCopy.noUnit = data2.length;
  //           next();
  //           return itemsCopy;
  //         },
  //         () => {
  //           res.send({
  //             code: 200,
  //             propertiesData,
  //           });
  //         },
  //       );
  //     } else {
  //       propertiesData = await DB.select('property', { userId: body.affiliateId });
  //       each(
  //         propertiesData,
  //         async (items, next) => {
  //           const itemsCopy = items;
  //           const data = await DB.select('unitType', { propertyId: items.id });
  //           const data2 = await DB.select('unit', { propertyId: items.id });
  //           itemsCopy.noUnitType = data.length;
  //           itemsCopy.noUnit = data2.length;
  //           next();
  //           return itemsCopy;
  //         },
  //         () => {
  //           res.send({
  //             code: 200,
  //             propertiesData,
  //           });
  //         },
  //       );
  //     }
  //     console.log(propertiesData);
  //   } catch (e) {
  //     console.log(e);
  //     res.send({
  //       code: 444,
  //       msg: 'Some error has occured!',
  //     });
  //   }
  // });

  router.post('/addUnitType', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      if (body.name.replace(/\s/g, '').length > 0) {
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
          const saveData = await DB.insert('unitType', unitTypeData);
          const unitData = {
            userId: id,
            propertyId: body.propertyId,
            unittypeId: saveData,
            unitName: body.name,
          };
          await DB.insert('unit', unitData);
          res.send({
            code: 200,
            msg: 'Data save Successfully!',
          });
        }
      } else {
        res.send({
          code: 422,
          msg: 'Unittype name should not only contains whitespace',
        });
      }
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      console.log('body', body);
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const unittypeData = await DB.select('unitType', { propertyId: body.propertyId });
      console.log('unittypeData', unittypeData);
      const units = await DB.select('unit', { userId: id });
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: e,
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
        propertyId: body.propertyId,
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
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/groupList', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const groupDetail = await DB.select('groups', { userId: body.tokenData.userid, propertyId: body.propertyId });
      res.send({
        code: 200,
        groupDetail,
      });
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
            serviceAmount: el.serviceAmount,
          };
          await DB.insert('bookingService', Data);
        });
      }

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
      sentryCapture(e);
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
          await DB.remove('guest', { id: body.deleteServiceId });
        } catch (e) {
          sentryCapture(e);
          res.send({
            code: 400,
            msg: e,
          });
        }
      }
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
        unitTypeId: body.unitTypeId,
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
        await DB.update('guestV2', guestData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Changes saved successfully!',
        });
      } else {
        await DB.insert('guestV2', guestData);
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
      sentryCapture(e);
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
      await DB.update('guestV2', guestData, { id: body.guestId });
      res.send({
        code: 200,
        msg: 'Data Update Successfully!',
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

  router.post('/deleteGuest', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('guestV2', { id: body.id });
      res.send({
        code: 200,
        msg: 'Data Deleted Successfully!',
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API to get amenities
  router.post('/getAmenities', userAuthCheck, async (req, res) => {
    try {
      const amenities = await DB.select('amenities', {});
      const data = await DB.selectCol(['amenities'], 'unitTypeV2', { id: req.body.unitTypeV2Id });
      console.log('data from get amenities', data);
      const selectedAmenities = [];
      if (data && data[0].amenities) {
        const [{ amenities: selectedAmenity }] = data;
        selectedAmenity.forEach((id) => {
          const [data0] = amenities.filter((el) => el.id === id);
          selectedAmenities.push(data0);
        });
      }
      res.send({
        code: 200,
        amenities,
        selectedAmenities,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
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
      const unitType = await DB.select('unitType', { userId: id });
      const unit = await DB.select('unit', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        unittypeData: unitType,
        unitData: unit,
      });
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  router.post('/getPropDetails', userAuthCheck, async (req, res) => {
    try {
      const { body } = req;
      const propertyData = await DB.selectCol(['address'], 'unitTypeV2', { id: body.unitTypeId });
      const [{ address }] = propertyData;
      const userData = await DB.selectCol(['fullname', 'email', 'phone'], 'users', { id: body.tokenData.userid });
      const [{ fullname, email, phone }] = userData;
      const payloadData = {
        address,
        fullname,
        email,
        phone,
      };
      res.send({
        code: 200,
        payloadData,
      });
    } catch (e) {
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for downloding invoice

  router.post('/downloadinvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      pdf.create(invoiceTemplate(body), { timeout: '100000' }).toFile(
        `${__dirname}/${body.clientName}.pdf`,
        async (err, success) => {
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
          const data = await uploadPdf(buffer, hash, type, body.tokenData.organizationid);
          console.log('s3 response', data);
          // data.Location is uploaded url
          // this will remove pdf file after it is uploaded
          fs.unlinkSync(success.filename);
          res.send({
            code: 200,
            msg: 'Successfully downloaded invoice',
            url: data.Location,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: e.msg,
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
          const data = await uploadPdf(buffer, hash, type, body.tokenData.organizationid);
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
            logo: body.logo,
            currency: body.currency,
          };
          if (!body.id) {
            const Id = await DB.insert('invoiceV2', invoiceData);
            console.log('invoice id', Id);
            body.itemData.map(async (el) => {
              const Data = {
                invoiceId: Id,
                itemDescription: el.itemDescription,
                quantity: el.itemQuantity,
                price: el.itemPrice,
                amount: el.itemAmount,
                discount: el.itemDiscount,
                discountPer: el.itemDiscountPer,
                discountType: el.itemDiscountType,
                itemTotal: el.itemTotal,
              };
              await DB.insert('invoiceItemsV2', Data);
            });
            if (body.deleteInvoiceItemId) {
              await DB.remove('invoiceItemsV2', { id: body.deleteInvoiceItemId });
            }
          } else {
            await DB.update('invoiceV2', invoiceData, { id: body.id });
            body.itemData.map(async (el) => {
              const Data = {
                invoiceId: body.id,
                itemDescription: el.itemDescription,
                quantity: el.quantity,
                price: el.price,
                amount: el.amount,
                discount: el.discount,
                discountPer: el.discountPer,
                discountType: el.itemDiscountType,
                itemTotal: el.itemTotal,
              };
              await DB.update('invoiceItemsV2', Data);
            });
          }
          res.send({
            code: 200,
            msg: 'Successfully drafted invoice',
            url: data.Location,
          });
        });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
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
      const invoiceData = await DB.select('invoiceV2', { userId: id });
      const invoiceItems = [];
      each(
        invoiceData,
        async (items, next) => {
          const data = await DB.select('invoiceItemsV2', { invoiceId: items.id });
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
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: e,
      });
    }
  });
  // API for delete invoice
  router.post('/deleteInvoice', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const invoiceId = body.deleteId;
      await DB.remove('invoiceV2', { id: invoiceId });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      await DB.update('invoiceV2', invoiceData, { id: invoiceId });
      res.send({
        code: 200,
        msg: 'Invoice Cancelled!',
      });
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const companyData = await DB.select('organizations', { name: body.company });
      if (companyData.length) {
        const userExists = await DB.select('users', { email: body.email, organizationId: companyData[0].id });
        console.log('userExists', userExists);
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
            bookingDelete: body.bookingDelete,
            calendarRead: body.calendarRead,
            calendarWrite: body.calendarWrite,
            calendarDelete: body.calendarDelete,
            propertiesRead: body.propertiesRead,
            propertiesWrite: body.propertiesWrite,
            propertiesDelete: body.propertiesDelete,
            channelRead: body.channelRead,
            channelWrite: body.channelWrite,
            channelDelete: body.channelDelete,
            guestsRead: body.guestsRead,
            guestsWrite: body.guestsWrite,
            guestsDelete: body.guestsDelete,
            serviceRead: body.serviceRead,
            serviceWrite: body.serviceWrite,
            serviceDelete: body.serviceDelete,
            teamRead: body.teamRead,
            teamWrite: body.teamWrite,
            teamDelete: body.teamDelete,
            invoicesRead: body.invoicesRead,
            invoicesWrite: body.invoicesWrite,
            invoicesDelete: body.invoicesDelete,
            statsRead: body.statsRead,
            statsWrite: body.statsWrite,
            statsDelete: body.statsDelete,
            ownerRead: body.ownerRead,
            ownerWrite: body.ownerWrite,
            ownerDelete: body.ownerDelete,
            billingRead: body.billingRead,
            billingWrite: body.billingWrite,
            billingDelete: body.billingDelete,
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
              organizationId: companyData[0].id,
              email: body.email,
              verificationhex: hash,
              encrypted_password: hashedPassword,
            };
            await DB.insert('users', userData);

            const url = frontendUrl(body.company, '/', {
              token: userData.verificationhex,
            });
            console.log('url in team section', url);
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
      }
    } catch (e) {
      sentryCapture(e);
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
        bookingDelete: body.bookingDelete,
        calendarRead: body.calendarRead,
        calendarWrite: body.calendarWrite,
        calendarDelete: body.calendarDelete,
        propertiesRead: body.propertiesRead,
        propertiesWrite: body.propertiesWrite,
        propertiesDelete: body.propertiesDelete,
        channelRead: body.channelRead,
        channelWrite: body.channelWrite,
        channelDelete: body.channelDelete,
        guestsRead: body.guestsRead,
        guestsWrite: body.guestsWrite,
        guestsDelete: body.guestsDelete,
        serviceRead: body.serviceRead,
        serviceWrite: body.serviceWrite,
        serviceDelete: body.serviceDelete,
        teamRead: body.teamRead,
        teamWrite: body.teamWrite,
        teamDelete: body.teamDelete,
        invoicesRead: body.invoicesRead,
        invoicesWrite: body.invoicesWrite,
        invoicesDelete: body.invoicesDelete,
        statsRead: body.statsRead,
        statsWrite: body.statsWrite,
        statsDelete: body.statsDelete,
        ownerRead: body.ownerRead,
        ownerWrite: body.ownerWrite,
        ownerDelete: body.ownerDelete,
        billingRead: body.billingRead,
        billingWrite: body.billingWrite,
        billingDelete: body.billingDelete,
      };
      console.log(subUserData);
      await DB.update('team', subUserData, { id: body.id });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const subUser = await DB.select('team', { userId: id });
      each(
        subUser,
        async (items, next) => {
          const itemsCopy = items;
          console.log(itemsCopy);
          const data = await DB.selectCol(['isvalid', 'fullname'], 'users', { email: itemsCopy.email });
          console.log(data);
          const [{ isvalid, fullname }] = data;
          itemsCopy.status = isvalid;
          itemsCopy.fullname = fullname;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            subUser,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });
  // API for Resend Mail
  router.post('/resend-email', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const password = randomstring.generate(7);
      console.log('password', password);
      const hashedPassword = await hashPassword(password);
      const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
      const userData = {
        verificationhex: hash,
        encrypted_password: hashedPassword,
      };
      await DB.update('users', userData, { id: body.id });
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
    } catch (e) {
      sentryCapture(e);
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
        bookingDelete: body.bookingDelete,
        calendarRead: body.calendarRead,
        calendarWrite: body.calendarWrite,
        calendarDelete: body.calendarDelete,
        propertiesRead: body.propertiesRead,
        propertiesWrite: body.propertiesWrite,
        propertiesDelete: body.propertiesDelete,
        guestsRead: body.guestsRead,
        guestsWrite: body.guestsWrite,
        guestsDelete: body.guestsDelete,
        serviceRead: body.serviceRead,
        serviceWrite: body.serviceWrite,
        serviceDelete: body.serviceDelete,
        teamRead: body.teamRead,
        teamWrite: body.teamWrite,
        teamDelete: body.teamDelete,
        invoicesRead: body.invoicesRead,
        invoicesWrite: body.invoicesWrite,
        invoicesDelete: body.invoicesDelete,
        statsRead: body.statsRead,
        statsWrite: body.statsWrite,
        statsDelete: body.statsDelete,
        ownerRead: body.ownerRead,
        ownerWrite: body.ownerWrite,
        ownerDelete: body.ownerDelete,
        billingRead: body.billingRead,
        billingWrite: body.billingWrite,
        billingDelete: body.billingDelete,
      };
      console.log(subUserData);
      await DB.update('team', subUserData, { id: body.id });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      let id;
      if (body.affiliateId) {
        id = body.affiliateId;
      } else {
        id = body.tokenData.userid;
      }
      const subUser = await DB.select('team', { userId: id });
      each(
        subUser,
        async (items, next) => {
          const itemsCopy = items;
          const data = await DB.selectCol(['isvalid', 'fullname'], 'users', { email: itemsCopy.email });

          const [{ isvalid, fullname }] = data;
          itemsCopy.status = isvalid;
          itemsCopy.fullname = fullname;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            subUser,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for adding sub owner
  router.post('/addOwner', userAuthCheck, async (req, res) => {
    const { ...body } = req.body;
    console.log('addOwner', body);
    try {
      let id;
      let verificationhex;
      let encryptedPassword;
      if (body.access) {
        const password = randomstring.generate(7);
        console.log(password);
        const hashedPassword = await hashPassword(password);
        const hash = crypto.createHmac('sha256', 'verificationHash').update(body.email).digest('hex');
        verificationhex = hash;
        encryptedPassword = hashedPassword;
        // const confirmationUrl = `http://${body.company}.localhost:3001/?token=${hash}`;
        const confirmationUrl = ownerPanelUrl(body.company, '/', {
          token: hash,
        });
        console.log('confirmationUrl', confirmationUrl);
        const msg = {
          from: config.get('mailing.from'),
          templateId: config.get('mailing.sendgrid.templates.en.ownerConfirmation'),
          personalizations: [
            {
              to: [
                {
                  email: body.email,
                },
              ],
              dynamic_template_data: {
                receipt: true,
                password,
                link: confirmationUrl,
              },
            },
          ],
        };

        sgMail.send(msg);
      }
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
        // properties: JSON.stringify(body.properties),
        notes: body.notes,
        isaccess: body.access,
        verificationhex,
        encrypted_password: encryptedPassword,
      };

      if (body.id) {
        await DB.update('owner', ownerData, { id: body.id });
        await DB.update('unitTypeV2', { ownerId: 0 }, { ownerId: body.id });
        each(body.properties, async (items, next) => {
          console.log(items);
          await DB.update('unitTypeV2', { ownerId: body.id }, { id: items.id });
          next();
        });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        const saveData = await DB.insert('owner', ownerData);
        each(body.properties, async (items, next) => {
          await DB.update('unitTypeV2', { ownerId: saveData }, { id: items.id });
          next();
        });
        res.send({
          code: 200,
          msg: 'Data saved successfully!',
        });
      }
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      await DB.update('unitTypeV2', { ownerId: 0 }, { ownerId: body.id });
      res.send({
        code: 200,
        msg: 'Data remove successfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for upload picture
  router.post('/photo', async (req, res) => {
    const form = new multiparty.Form();
    console.log(req.query);
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
        const data = await uploadFile(buffer, hash, type, req.query.organizationid);
        console.log('photo url', data.Location);
        const d0 = await DB.update('users', { image: data.Location }, { id: req.query.userid });
        console.log(d0);
        return res.json({
          image: data.Location,
        });
      } catch (e) {
        sentryCapture(e);
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
  router.post('/propertyPicture', async (req, res) => {
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
        const hash = crypto.createHash('md5').update(fileName).digest('hex');
        const data = await uploadFile(buffer, hash, type, req.query.organizationid);
        await DB.update('property', { image: data.Location }, { id: req.query.propertyid });
        return res.json({
          image: data.Location,
        });
      } catch (e) {
        sentryCapture(e);
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
      const servicData = {
        propertyId: body.propertyNo,
        serviceName: body.servicename,
        servicePrice: body.serviceprice,
        quantity: body.servicequantity,
      };
      if (body.serviceId) {
        // await DB.update('service', servicData, { id: body.serviceId });
        await DB.update('serviceV2', servicData, { id: body.serviceId });
        res.send({

          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('serviceV2', servicData);
        res.send({
          code: 200,
          msg: 'Data save successfully!',
        });
      }
    } catch (e) {
      sentryCapture(e);
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
      console.log('Ravi Verma', body);
      const servicData = await DB.select('serviceV2', {
        propertyId: body.propertyId,
      });
      console.log('servicData', servicData);
      res.send({
        code: 200,
        servicData,
      });
    } catch (e) {
      sentryCapture(e);
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
      await DB.remove('serviceV2', {
        id: body.id,
      });
      res.send({
        code: 200,
        msg: 'Data Remove Sucessfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
        fullname: body.fullname,
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
      sentryCapture(e);
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
        companyName: body.companyName,
        address: body.address,
        country: body.country,
        state: body.state,
        city: body.city,
        zip: body.zip,
        vatId: body.vatId,
      };
      await DB.update('organizations', companyData, { id: body.tokenData.organizationid });
      res.send({
        code: 200,
        msg: 'Data saved successfully!',
      });
    } catch (e) {
      sentryCapture(e);
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
      const userData = await DB.selectCol(['fullname', 'address', 'email', 'phone', 'image', 'timeZone'], 'users', {
        id: body.tokenData.userid,
      });
      res.send({
        code: 200,
        userData,
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });
  // API to get user info
  router.post('/getuserDetails', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const userData = await DB.selectCol(['fullname', 'email'], 'users', {
        id: body.tokenData.userid,
      });
      res.send({
        code: 200,
        userData,
      });
    } catch (e) {
      sentryCapture(e);
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
      const companyData = await DB.select('organizations', { name: body.company });
      res.send({
        code: 200,
        companyData,
      });
    } catch (e) {
      sentryCapture(e);
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
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid, unitTypeId: body.propertyId });
      } else {
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid });
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
      sentryCapture(e);
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
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid, unitTypeId: body.propertyId });
      } else {
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid });
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
      sentryCapture(e);
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
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid, unitTypeId: body.propertyId });
      } else {
        revenueData = await DB.select('bookingV2', { userId: body.tokenData.userid });
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
      sentryCapture(e);
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
      const guestData = await DB.select('guestV2', { userId: body.tokenData.userid });
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
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  /**
   * *  Billing related apis
   */

  // API for charging customer and activating subscription
  router.post('/charge', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const {
        stripeToken,
        // amount,
        interval,
        noOfUnits,
        currency,
        planType,
        coupon,
      } = body;
      const data = await DB.selectCol(['email'], 'users', { id: req.body.tokenData.userid });
      const [{ email }] = data;
      // const now = new Date();
      // const nextdate = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      // const nextMonth = nextdate / 1000;
      // create the customer
      const customer = await stripe.customers.create({
        email,
        source: stripeToken,
        metadata: { currency },
      });
      let subscription;
      // checking for monthly and yearly plan & apply coupon
      if (interval === 'month') {
        // creating the monthly subscription
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [
            {
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
          expand: ['latest_invoice.payment_intent', 'plan.product'],
        });
      } else if (coupon) {
        // retrieving the coupon id from coupon code
        const couponCode = await stripe.coupons.retrieve(coupon);
        // creating the yearly subscription
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [
            {
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
          coupon: couponCode.id,
          expand: ['latest_invoice.payment_intent', 'plan.product'],
        });
      } else {
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [
            {
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
          expand: ['latest_invoice.payment_intent', 'plan.product'],
        });
      }

      if (subscription.status === 'active') {
        const subscriptionObject = {
          productId: subscription.plan.product.id,
          customerId: customer.id,
          subscriptionId: subscription.id,
          subscription: true,
          userId: body.tokenData.userid,
          units: noOfUnits,
          Amount: subscription.latest_invoice.amount_paid / 100,
          interval: subscription.plan.interval,
          planType,
          currency,
        };
        await DB.insert('subscription', subscriptionObject);
        await DB.update('users', { isSubscribed: true, isOnTrial: false }, { id: body.tokenData.userid });
        if (planType === 'basic') {
          await DB.update(
            'feature',
            { follow: 'basic' },
            { organizationId: body.tokenData.organizationid },
          );
          await DB.update('organizations', { planType: 'basic' }, { id: body.tokenData.organizationid });
        }
        res.send({
          code: 200,
          msg: 'Transaction successfull',
        });
      } else {
        res.send({
          code: 444,
          msg: 'payment failed',
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      if (e.statusCode === 400) {
        res.send({
          code: 400,
          msg: 'Payment failed!',
        });
      } else {
        res.send({
          code: 444,
          msg: 'some error occurred!',
        });
      }
    }
  });

  // API for getting transaction
  router.get('/transactions', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const transactions = await DB.select('subscription', { userId: body.tokenData.userid });
      if (transactions && transactions.length) {
        const subscription = await stripe.subscriptions.retrieve(transactions[0].subscriptionId);
        console.log('subscription', subscription);
        const endDate = subscription.current_period_end * 1000;
        const { status } = subscription;
        res.send({
          code: 200,
          transactions,
          endDate,
          status,
        });
      } else {
        const data = await DB.selectCol(['isSubscribed', 'created_at'], 'users', { id: body.tokenData.userid });
        const [{ isSubscribed, created_at: createdAt }] = data;
        if (parseInt(isSubscribed, 10)) {
          const onFreePlan = true;
          res.send({
            code: 200,
            onFreePlan,
            createdAt,
          });
        } else {
          res.send({
            code: 444,
            msg: 'some error occured',
          });
        }
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  router.post('/getBillingInvoice', userAuthCheck, async (req, res) => {
    try {
      const Data = await DB.select('subscription', { userId: req.body.tokenData.userid });
      if (Data && Data.length > 0) {
        const [{ customerId }] = Data;
        const invoices = await stripe.invoices.list({ customer: customerId });
        console.log('customer invoices', invoices);
        console.log(Object.keys(invoices).length === 0 && invoices.constructor === Object);
        if (Object.keys(invoices).length === 0 && invoices.constructor === Object) {
          res.send({
            code: 404,
            msg: 'No invoices for this customer',
          });
        } else {
          const { data } = invoices;
          res.send({
            code: 200,
            data,
          });
        }
      } else {
        res.send({
          code: 200,
          msg: 'no invoices',
        });
      }
    } catch (e) {
      sentryCapture(e);
      res.send({ code: 444, msg: 'Some error has occured.' });
    }
  });
  // API for cancelling subscription
  router.post('/cancelSubscription', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      stripe.subscriptions.del(body.subscriptionId, (err) => {
        if (err) {
          console.log(err);
          res.send({
            code: 444,
            err,
          });
        }
        res.send({
          code: 200,
          msg: 'Your subscription is cancelled',
        });
      });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
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
        // amount,
        interval,
        noOfUnits,
        // currency,
        planType,
        coupon,
      } = body;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      let updatedSubscription;
      if (interval === 'month') {
        updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
          proration_behavior: 'create_prorations',
          items: [
            {
              id: subscription.items.data[0].id,
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
        });
      } else if (coupon) {
        // retrieving the coupon id from coupon code
        const couponCode = await stripe.coupons.retrieve(coupon);
        // updating the subscription
        updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
          // pass always_invoice if oyu want to charge always
          proration_behavior: 'always_invoice',
          items: [
            {
              id: subscription.items.data[0].id,
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
          coupon: couponCode.id,
        });
      } else {
        updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
          proration_behavior: 'create_prorations',
          items: [
            {
              id: subscription.items.data[0].id,
              price: interval === 'month' ? config.get('payments.monthlyPlan') : config.get('payments.yearlyPlan'),
              quantity: noOfUnits,
            },
          ],
        });
      }

      console.log(updatedSubscription);
      if (updatedSubscription.status === 'active') {
        const invoice = await stripe.invoices.retrieve(updatedSubscription.latest_invoice);
        console.log('latest invoice', invoice);
        const payload = {
          subscriptionId: updatedSubscription.id,
          planId: updatedSubscription.plan.id,
          productId: updatedSubscription.plan.product,
          units: noOfUnits,
          interval,
          planType,
          amount: invoice.amount_paid / 100,
        };
        await DB.update('subscription', payload, { userId: body.tokenData.userid });
        if (planType === 'basic') {
          await DB.update(
            'feature',
            { follow: 'basic' },
            { organizationId: body.tokenData.organizationid },
          );
          await DB.update('organizations', { planType: 'basic' }, { id: body.tokenData.organizationid });
        }
        res.send({
          code: 200,
          msg: 'your plan is successfully changed',
        });
      } else {
        res.send({
          code: 444,
          msg: 'payment failed',
        });
      }
    } catch (e) {
      sentryCapture(e);
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
      if (Data && Data.length > 0) {
        const [{ subscriptionId }] = Data;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription) {
          if (subscription.status === 'canceled') {
            const end = moment(subscription.current_period_end * 1000).format('YYYY-MM-DD');
            const today = moment(new Date()).format('YYYY-MM-DD');
            const compare = moment(end).isSameOrBefore(today);
            if (compare) {
              await DB.update('users', { isSubscribed: false, issubscriptionEnded: true }, { id: body.tokenData.userid });
            }
          } else if (subscription.status !== 'active') {
            await DB.update('users', { isSubscribed: false, issubscriptionEnded: true }, { id: body.tokenData.userid });
          }
        }
        res.send({
          code: 200,
          msg: 'subscription status updated',
        });
      } else {
        res.send({
          code: 200,
          msg: 'user not subscribed to any plan',
        });
      }
    } catch (e) {
      sentryCapture(e);
      res.send({
        code: 444,
        msg: 'some error occured!',
      });
    }
  });

  // getting subscribed status of user
  router.post('/getUserSubscriptionStatus', userAuthCheck, async (req, res) => {
    try {
      // const { userid } = req.body.tokenData;
      let id;
      if (req.body.affiliateId) {
        id = req.body.affiliateId;
      } else {
        id = req.body.tokenData.userid;
      }
      const userSubsDetails = await DB.selectCol(
        ['isSubscribed', 'isOnTrial', 'trialEnded', 'issubscriptionEnded', 'created_at'],
        'users',
        { id },
      );
      // console.log('user subs details ====>>>>>>>', userSubsDetails);
      if (userSubsDetails && userSubsDetails.length > 0) {
        const [{ trialEnded, created_at: createdAt }] = userSubsDetails;
        let diff;
        if (trialEnded) {
          diff = Math.abs(trialEnded - new Date());
        } else {
          diff = Math.abs(new Date() - createdAt);
        }
        // const diff = Math.abs(new Date() - createdAt);
        let s = Math.floor(diff / 1000);
        let m = Math.floor(s / 60);
        s %= 60;
        let h = Math.floor(m / 60);
        m %= 60;
        const totalDays = Math.floor(h / 24);
        h %= 24;
        const remainingDays = trialEnded ? totalDays : config.get('TRIAL_DAYS') - totalDays;
        userSubsDetails[0].days = remainingDays;
        res.send({
          code: 200,
          userSubsDetails,
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
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
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for adding group reservation
  router.post('/groupReservation', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      let id;
      let guest;
      let adult;
      const startDateTime = new Date(body.groupname[0]);
      const endDateTime = new Date(body.groupname[1]);

      if (!body.affiliateId) {
        id = body.tokenData.userid;
      } else {
        id = body.affiliateId;
      }

      each(
        body.unitType,
        async (items, next) => {
          const itemsCopy = items;
          const unitData = await DB.selectCol(['unitName'], 'unitV2', { id: items });
          if (body.fullName) {
            guest = body.fullName;
            adult = 1;
          } else {
            guest = 'No Guest';
            adult = 0;
          }
          const reservationData = {
            userId: id,
            unitTypeId: body.propertyId,
            propertyName: body.propertyName,
            bookedUnit: items,
            unitName: unitData[0].unitName,
            startDate: startDateTime,
            endDate: endDateTime,
            acknowledge: body.acknowledge,
            channel: body.channel,
            commission: body.commissionPercentage,
            adult,
            guest,
            notes1: body.notes1,
            perNight: body.perNight,
            night: body.night,
            discount: body.discount,
            accomodation: parseFloat(body.totalAmount / body.unitType.length).toFixed(2),
            totalAmount: parseFloat(body.totalAmount / body.unitType.length).toFixed(2),
          };
          const saveData = await DB.insert('bookingV2', reservationData);
          const Data = {
            userId: id,
            bookingId: saveData,
            fullname: body.fullName,
            country: body.country,
            email: body.email,
            phone: body.phone,
          };
          await DB.insert('guestV2', Data);
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            msg: 'Group Reservation save successfully!',
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

  // API for deleting bookings
  router.post('/deleteBookings', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      each(
        body.bookings,
        async (items, next) => {
          const itemsCopy = items;
          await DB.remove('booking', { id: items });
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

  // API for add rates for unitType
  router.post('/addRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const rateData = {
        unitTypeId: body.unitTypeId,
        rateName: body.rateName,
        currency: body.currency,
        price_per_night: body.pricePerNight,
        minimum_stay: body.minStay,
        discount_price_per_week: body.weeklyPrice,
        discount_price_per_month: body.monthlyPrice,
        discount_price_custom_nights: body.customNightsPrice,
        price_on_monday: body.priceOnMon,
        price_on_tuesday: body.priceOnTues,
        price_on_wednesday: body.priceOnWed,
        price_on_thursday: body.priceOnThu,
        price_on_friday: body.priceOnFri,
        price_on_saturday: body.priceOnSat,
        price_on_sunday: body.priceOnSun,
        minimum_stay_on_monday: body.minStayOnMon,
        minimum_stay_on_tuesday: body.minStayOnTues,
        minimum_stay_on_wednesday: body.minStayOnWed,
        minimum_stay_on_thursday: body.minStayOnThu,
        minimum_stay_on_friday: body.minStayOnFri,
        minimum_stay_on_saturday: body.minStayOnSat,
        minimum_stay_on_sunday: body.minStayOnSun,
        extra_charge_on_guest: body.extraCharge,
        extra_guest: body.extraGuest,
        short_stay: body.shortStayNight,
        extra_chage_on_stay: body.shortStayPrice,
        checkIn_on_monday: body.checkIn_on_monday,
        checkIn_on_tuesday: body.checkIn_on_tuesday,
        checkIn_on_wednesday: body.checkIn_on_wednesday,
        checkIn_on_thursday: body.checkIn_on_thursday,
        checkIn_on_friday: body.checkIn_on_friday,
        checkIn_on_saturday: body.checkIn_on_saturday,
        checkIn_on_sunday: body.checkIn_on_sunday,
        checkOut_on_monday: body.checkOut_on_monday,
        checkOut_on_tuesday: body.checkOut_on_tuesday,
        checkOut_on_wednesday: body.checkOut_on_wednesday,
        checkOut_on_thursday: body.checkOut_on_thursday,
        checkOut_on_friday: body.checkOut_on_friday,
        checkOut_on_saturday: body.checkOut_on_saturday,
        checkOut_on_sunday: body.checkOut_on_sunday,
        tax_status: body.tax,
        tax: body.taxPer,
        notes: body.notes,
      };
      await DB.insert('rates', rateData);
      res.send({
        code: 200,
        msg: 'Data save successfully!',
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

  // API for add rates for unitType
  router.post('/getRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const ratesData = await DB.select('ratesV2', { unitTypeId: body.unittypeId });
      const seasonRatesData = await DB.select('seasonRatesV2', { unitTypeId: body.unittypeId });
      res.send({
        code: 200,
        ratesData,
        seasonRatesData,
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

  // API forlisting in copyRates
  router.post('/getUnitTypeRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const unittypeData = await DB.select('unitType', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        unittypeData,
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

  // API for add Season Rates
  router.post('/addSeasonRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let startDateTime;
      let endDateTime;
      if (body.groupname) {
        startDateTime = new Date(body.groupname[0]);
        endDateTime = new Date(body.groupname[1]);
      }

      const seasonRateData = {
        unitTypeId: body.unitTypeId,
        seasonRateName: body.seasonRateName,
        startDate: startDateTime,
        endDate: endDateTime,
        price_per_night: body.pricePerNight,
        minimum_stay: body.minStay,
        discount_price_per_week: body.weeklyPrice,
        discount_price_per_month: body.monthlyPrice,
        discount_price_custom_nights: body.customNightsPrice,
        price_on_monday: body.priceOnMon,
        price_on_tuesday: body.priceOnTues,
        price_on_wednesday: body.priceOnWed,
        price_on_thursday: body.priceOnThu,
        price_on_friday: body.priceOnFri,
        price_on_saturday: body.priceOnSat,
        price_on_sunday: body.priceOnSun,
        minimum_stay_on_monday: body.minStayOnMon,
        minimum_stay_on_tuesday: body.minStayOnTues,
        minimum_stay_on_wednesday: body.minStayOnWed,
        minimum_stay_on_thursday: body.minStayOnThu,
        minimum_stay_on_friday: body.minStayOnFri,
        minimum_stay_on_saturday: body.minStayOnSat,
        minimum_stay_on_sunday: body.minStayOnSun,
        extra_charge_on_guest: body.extraCharge,
        extra_guest: body.extraGuest,
        short_stay: body.shortStayNight,
        extra_chage_on_stay: body.shortStayPrice,
        checkIn_on_monday: body.checkIn_on_monday,
        checkIn_on_tuesday: body.checkIn_on_tuesday,
        checkIn_on_wednesday: body.checkIn_on_wednesday,
        checkIn_on_thursday: body.checkIn_on_thursday,
        checkIn_on_friday: body.checkIn_on_friday,
        checkIn_on_saturday: body.checkIn_on_saturday,
        checkIn_on_sunday: body.checkIn_on_sunday,
        checkOut_on_monday: body.checkOut_on_monday,
        checkOut_on_tuesday: body.checkOut_on_tuesday,
        checkOut_on_wednesday: body.checkOut_on_wednesday,
        checkOut_on_thursday: body.checkOut_on_thursday,
        checkOut_on_friday: body.checkOut_on_friday,
        checkOut_on_saturday: body.checkOut_on_saturday,
        checkOut_on_sunday: body.checkOut_on_sunday,
      };
      if (body.id) {
        await DB.update('seasonRates', seasonRateData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update successfully!',
        });
      } else {
        await DB.insert('seasonRates', seasonRateData);
        res.send({
          code: 200,
          msg: 'Data save successfully!',
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // API for get Season Rates
  router.post('/getSeasonRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const seasonRateData = await DB.select('seasonRates', { unitTypeId: body.unitTypeId });
      res.send({
        code: 200,
        seasonRateData,
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

  // API for delete seasonRate
  router.post('/deleteSeasonRate', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('seasonRates', { id: body.id });
      res.send({
        code: 200,
        msg: 'SeasonRate delete successfully!',
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

  // get seasonRatesData for an individual
  router.get('/getSeasonRate/:id', userAuthCheck, async (req, res) => {
    try {
      const seasonRateId = req.params.id;
      const seasonRateData = await DB.select('seasonRates', { id: seasonRateId });
      res.send({
        code: 200,
        seasonRateData,
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

  // api for list of guests
  router.post('/getGuest', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const guestData = await DB.select('guestV2', { userId: body.tokenData.userid });
      each(
        guestData,
        async (item, next) => {
          const itemsCopy = item;
          const bookingData = await DB.selectCol(['totalAmount', 'currency', 'night', 'noOfGuest'],
            'bookingV2', { id: item.bookingId });
          const [{
            totalAmount, currency, night, noOfGuest,
          }] = bookingData;
          itemsCopy.spent = totalAmount;
          itemsCopy.currency = currency;
          itemsCopy.nights = night;
          itemsCopy.guests = noOfGuest;
          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            guestData,
          });
        },
      );
      // res.send({
      //   code: 200,
      //   guestData,
      // });
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // api for copy rates of unitType
  router.post('/copyRates', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const rateData = {
        unitTypeId: body.newUnitType,
        rateName: body.rateName,
        currency: body.currency,
        price_per_night: body.price_per_night,
        minimum_stay: body.minimum_stay,
        discount_price_per_week: body.discount_price_per_week,
        discount_price_per_month: body.discount_price_per_month,
        discount_price_custom_nights: body.discount_price_custom_nights,
        price_on_monday: body.price_on_monday,
        price_on_tuesday: body.price_on_tuesday,
        price_on_wednesday: body.price_on_wednesday,
        price_on_thursday: body.price_on_thursday,
        price_on_friday: body.price_on_friday,
        price_on_saturday: body.price_on_saturday,
        price_on_sunday: body.price_on_sunday,
        minimum_stay_on_monday: body.minimum_stay_on_monday,
        minimum_stay_on_tuesday: body.minimum_stay_on_tuesday,
        minimum_stay_on_wednesday: body.minimum_stay_on_wednesday,
        minimum_stay_on_thursday: body.minimum_stay_on_thursday,
        minimum_stay_on_friday: body.minimum_stay_on_friday,
        minimum_stay_on_saturday: body.minimum_stay_on_saturday,
        minimum_stay_on_sunday: body.minimum_stay_on_sunday,
        extra_charge_on_guest: body.extra_charge_on_guest,
        extra_guest: body.extra_guest,
        short_stay: body.short_stay,
        extra_chage_on_stay: body.extra_chage_on_stay,
        checkIn_on_monday: body.checkIn_on_monday,
        checkIn_on_tuesday: body.checkIn_on_tuesday,
        checkIn_on_wednesday: body.checkIn_on_wednesday,
        checkIn_on_thursday: body.checkIn_on_thursday,
        checkIn_on_friday: body.checkIn_on_friday,
        checkIn_on_saturday: body.checkIn_on_saturday,
        checkIn_on_sunday: body.checkIn_on_sunday,
        checkOut_on_monday: body.checkOut_on_monday,
        checkOut_on_tuesday: body.checkOut_on_tuesday,
        checkOut_on_wednesday: body.checkOut_on_wednesday,
        checkOut_on_thursday: body.checkOut_on_thursday,
        checkOut_on_friday: body.checkOut_on_friday,
        checkOut_on_saturday: body.checkOut_on_saturday,
        checkOut_on_sunday: body.checkOut_on_sunday,
        tax_status: body.tax_status,
        tax: body.tax,
        notes: body.notes,
      };
      await DB.insert('rates', rateData);
      res.send({
        code: 200,
        msg: 'Data save successfully!',
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

  // api for updateTimeZone of users
  router.post('/updateTimeZone', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.update('users', { timeZone: body.timezone }, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Data update successfully!',
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

  // api for adc companies of users
  router.post('/addCompany', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const companyData = {
        userId: body.tokenData.userid,
        name: body.name,
        vatId: body.vat,
        email: body.email,
        address: body.address,
      };
      if (body.id) {
        await DB.update('company', companyData, { id: body.id });
        res.send({
          code: 200,
          msg: 'Data update sucessfully!',
        });
      } else {
        await DB.insert('company', companyData);
        res.send({
          code: 200,
          msg: 'Data save sucessfully!',
        });
      }
    } catch (e) {
      sentryCapture(e);
      console.log(e);
      res.send({
        code: 444,
        msg: 'some error occured',
      });
    }
  });

  // api for getting company list
  router.post('/getCompanyList', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const companyData = await DB.select('company', { userId: body.tokenData.userid });
      res.send({
        code: 200,
        companyData,
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

  // API for delete company
  router.post('/deleteCompany', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.remove('company', { id: body.id });
      res.send({
        code: 200,
        msg: 'Company delete successfully!',
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

  // API for reomve profile picture
  router.post('/removeProfile', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      await DB.update('users', { image: null }, { id: body.tokenData.userid });
      res.send({
        code: 200,
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

  // API for get channelManagement Report
  router.post('/getChannelsReport', userAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      let unittypeData;
      let revenueData;
      if (body.propertyId !== null) {
        unittypeData = await DB.select('unitTypeV2',
          {
            userId: body.tokenData.userid,
            id: body.propertyId,
            isChannelManagerActivated: 1,
          });
      } else {
        unittypeData = await DB.select('unitTypeV2',
          {
            userId: body.tokenData.userid,
            isChannelManagerActivated: 1,
          });
      }
      if (body.propertyId !== null) {
        revenueData = await DB.select('bookingV2',
          {
            userId: body.tokenData.userid,
            unitTypeId: body.propertyId,
          });
      } else {
        revenueData = await DB.select('bookingV2',
          {
            userId: body.tokenData.userid,
          });
      }
      const airbnb = revenueData
        .filter((el) => el.channel === 'airbnb');

      const booking = revenueData
        .filter((el) => el.channel === 'booking');

      const expedia = revenueData
        .filter((el) => el.channel === 'expedia');
      const airbnbPer = (airbnb.length / revenueData.length) * 100;
      const bookingPer = (booking.length / revenueData.length) * 100;
      const expediaPer = (expedia.length / revenueData.length) * 100;
      res.send({
        code: 200,
        airbnbPer,
        bookingPer,
        expediaPer,
        unittypeData,
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

module.exports = usersRouter;
