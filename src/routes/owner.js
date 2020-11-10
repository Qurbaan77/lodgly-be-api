const config = require('config');
const crypto = require('crypto');
const express = require('express');
const sgMail = require('@sendgrid/mail');
const each = require('sync-each');
const fs = require('fs');
const AWS = require('aws-sdk');
const fileType = require('file-type');
const multiparty = require('multiparty');
const pdf = require('html-pdf');
const DB = require('../services/database');
const { checkIfEmpty } = require('../functions');
const { signJwt } = require('../functions');
const { hashPassword } = require('../functions');
const { verifyHash } = require('../functions');
const { ownerPanelUrl } = require('../functions/frontend');
const { ownerAuthCheck } = require('../middlewares/middlewares');
const reportTemplate = require('../templates/reportTemplate');
const sentryCapture = require('../../config/sentryCapture');

sgMail.setApiKey(config.get('mailing.sendgrid.apiKey'));

const ownerRouter = () => {
  // router variable for api routing
  const router = express.Router();

  // AWS S3 upload function'
  const s3 = new AWS.S3({
    accessKeyId: config.get('aws.accessKey'),
    secretAccessKey: config.get('aws.accessSecretKey'),
  });

  // function for uploading invoice pdf
  const uploadPdf = async (buffer, name, type) => {
    const params = {
      ACL: 'public-read',
      Body: buffer,
      Bucket: config.get('aws.s3.storageBucketName'),
      Key: `${name}.${type.ext}`,
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    return s3.upload(params, url).promise();
  };

  const uploadImg = async (buffer, name, type) => {
    const params = {
      ACL: 'public-read',
      Body: buffer,
      Bucket: config.get('aws.s3.storageBucketName'),
      Key: `${name}.${type.ext}`,
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    return s3.upload(params, url).promise();
  };

  // get request to verify user email
  router.get('/verify/:hex', async (req, res) => {
    try {
      const verificationhex = req.params.hex;
      // const isExist = await userModel.getOneBy({ verificationhex });
      const isExist = await DB.select('owner', { verificationhex });
      if (isExist.length) {
        const updatedData = await DB.update('owner', { isvalid: 1 }, { id: isExist[0].id });
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

  // login API for Owner Panel
  router.post('/ownerLogin', async (req, res) => {
    const { ...body } = await req.body;
    console.log(body);
    try {
      const { isValid } = checkIfEmpty(body.email, body.password);
      console.log(isValid);
      const { password } = req.body;
      // finding user with email
      const isOwnerExists = await DB.select('owner', { email: body.email });

      if (isOwnerExists.length) {
        if (isOwnerExists[0].isvalid === 0) {
          res.send({
            code: 403,
            msg: 'This email is not verified',
          });
        } else if (isOwnerExists[0].isaccess === 0) {
          res.send({
            code: 403,
            msg: 'You are not allow to access',
          });
        } else {
          const isPasswordValid = await verifyHash(password, isOwnerExists[0].encrypted_password);
          if (isPasswordValid) {
          // valid password
            const token = signJwt(isOwnerExists[0].id);
            console.log('token on login', token);
            res.cookie('token', token, {
              maxAge: 999999999999,
              signed: true,
            });
            res.send({
              code: 200,
              msg: 'Login successfully',
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
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // post request for logout owner
  router.post('/logout', async (req, res) => {
    res.clearCookie('token').send('cookie cleared!');
  });

  // API for verify email
  router.post('/verifyEmail', async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      const ownerData = await DB.select('owner', { email: body.email });
      if (ownerData.length > 0) {
        const forgetPassHex = crypto
          .createHmac('sha256', 'forgetPasswordHex')
          .update(ownerData[0].email)
          .digest('hex');
        const updatedData = await DB.update(
          'owner',
          {
            forgetPassHex,
          },
          {
            email: body.email,
          },
        );
        if (updatedData) {
          const confirmationUrl = ownerPanelUrl('', config.get('frontend.owners.paths.resetPassword'), {
            token: forgetPassHex,
          });

          console.log(confirmationUrl);

          const msg = {
            from: config.get('mailing.from'),
            templateId: config.get('mailing.sendgrid.templates.en.resetPassword'),
            personalizations: [
              {
                to: [
                  {
                    email: body.email,
                  },
                ],
                dynamic_template_data: {
                  receipt: true,
                  confirmation_url: confirmationUrl,
                  email: body.email,
                  username: `${body.fname} ${body.lname}`,
                },
              },
            ],
          };

          sgMail.send(msg, (error, result) => {
            if (error) {
              console.log(error);
            } else {
              console.log(result);
            }
          });
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
          msg: 'Email not found!.',
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

  // API for reset password when forget password
  router.post('/resetPassword', async (req, res) => {
    try {
      const { ...body } = req.body;
      const ownerData = await DB.select('owner', { forgetPassHex: body.hex });
      if (ownerData.length > 0) {
        const newhashedPassword = await hashPassword(body.newpassword);
        if (newhashedPassword) {
          const updateData = await DB.update(
            'owner',
            {
              encrypted_password: newhashedPassword,
              forgetPassHex: '',
            },
            {
              email: ownerData[0].email,
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
          msg: 'Wrong token!',
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

  // API for fetch Owner property details
  router.post('/getProperty', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      // console.log(body);
      const unitData = [];
      const propertyData = await DB.select('unitTypeV2', { ownerId: body.tokenData.userid });
      each(
        propertyData,
        async (items, next) => {
          const count = [];
          const pricePerNights = [];
          const itemsCopy = items;
          let avgCount = 0;
          let avgCountPer = 0;
          let avgNightlyRate = 0;
          const bookingData = await DB.select('bookingV2', { unitTypeId: items.id });

          unitData.push(await DB.select('unitV2', { unitTypeId: items.id }));
          const imageData = await DB.selectCol(['url'], 'images', { unitTypeId: items.id });
          if (imageData && imageData.length > 0) {
            itemsCopy.image = imageData[0].url;
          }

          bookingData.forEach((el) => {
            count.push((el.endDate - el.startDate) / (1000 * 3600 * 24));
            pricePerNights.push(parseInt(el.perNight, 10));
          });
          avgCount = count.reduce((a, b) => a + (b || 0), 0) / count.length;
          avgCountPer = (count.reduce((a, b) => a + (b || 0), 0) / count.length / 30) * 100;
          avgNightlyRate = pricePerNights.reduce((a, b) => a + (b || 0), 0) / pricePerNights.length;
          itemsCopy.noBookedNights = Math.ceil(avgCount);
          itemsCopy.occupancy = Math.ceil(avgCountPer);
          itemsCopy.nightlyRate = Math.ceil(avgNightlyRate);

          next();
          return itemsCopy;
        },
        () => {
          res.send({
            code: 200,
            propertyData,
            unitData,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
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
      sentryCapture(e);
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
      sentryCapture(e);
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
      const hashedPassword = await hashPassword(body.password);
      await DB.update('owner', { encrypted_password: hashedPassword }, { id: body.tokenData.userid });
      res.send({
        code: 200,
        msg: 'Password change successfully!',
      });
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for fetch report
  router.post('/getReport', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const reportData = [];
      const propertyData = await DB.select('unitTypeV2', { ownerId: body.tokenData.userid });
      const unitData = await DB.select('unitV2', { userId: body.tokenData.userid });
      each(
        propertyData,
        async (items, next) => {
          reportData.push(await DB.select('bookingV2', { unitTypeId: items.id }));
          next();
        },
        () => {
          res.send({
            code: 200,
            reportData,
            propertyData,
            unitData,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API to download report in pdf format
  router.post('/downloadReport', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      pdf.create(reportTemplate(body), { timeout: '100000' }).toFile(`${body.unitName}.pdf`, async (err, success) => {
        if (err) {
          console.log('err', err);
        }
        console.log('success', success);
        // success.filename is saved file path
        const buffer = fs.readFileSync(success.filename);
        const type = await fileType.fromBuffer(buffer);
        const fileName = `bucketFolder/${body.unitName}`;
        // upload to AWS S3 bucket
        const data = await uploadPdf(buffer, fileName, type);
        console.log('s3 response', data);
        // data.Location is uploaded url
        // this will remove pdf file after it is uploaded
        fs.unlinkSync(success.filename);
        res.send({
          code: 200,
          msg: 'Successfully download report',
          url: data.Location,
        });
      });
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API to download report in pdf format
  router.post('/getStatistics', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const arr = [];
      const arr2 = [];
      const arr3 = [];
      const yearArr = [];
      const reportData = [];
      // const unitTypeData = [];
      let avgBooked = 0;
      let occupancy = 0;
      let perNight = 0;
      const propertyData = await DB.select('unitTypeV2', { ownerId: body.tokenData.userid });
      each(
        propertyData,
        async (items, next) => {
          reportData.push(await DB.select('bookingV2', { unitTypeId: items.id }));
          // unitTypeData.push(await DB.selectCol('perNight', 'unitType', { propertyId: items.id }));
          next();
        },
        () => {
          reportData.map((el) => el.map((ele) => arr.push(ele)));
          reportData.map((el) => el.map((ele) => arr3.push(parseInt(ele.perNight, 10))));
          arr
            .filter((el) => el.startDate.getFullYear() === body.changeYear)
            .forEach((filter) => {
              arr2.push(filter);
            });

          for (let i = 1; i <= 12; i += 1) {
            let avgPrevCount = 0;
            const prevCount = [];

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
              yearArr.push(Math.round(avgPrevCount));
            } else {
              yearArr.push(0);
            }
          }
          avgBooked = Math.round(yearArr.reduce((a, b) => a + (b || 0), 0) / yearArr.length);
          console.log(avgBooked);
          occupancy = Math.round(avgBooked / 30) * 100;
          console.log('occupancy', occupancy);
          perNight = Math.round(arr3.reduce((a, b) => a + (b || 0), 0) / arr3.length);
          res.send({
            code: 200,
            avgBooked,
            occupancy,
            perNight,
            yearArr,
          });
        },
      );
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for getting booking detail of units
  router.post('/getBooking', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const arr = [];
      // const bookingData = await DB.select('bookingV2', { unitTypeId: body.propertyId, status: 'booked' });
      const bookingData = await DB.select('bookingV2', { unitTypeId: body.propertyId });
      bookingData.forEach((el) => {
        arr.push({
          id: el.id,
          title: `${el.totalAmount} ${el.guest}`,
          start: el.startDate,
          end: new Date(el.endDate.setDate(el.endDate.getDate() + 1)),
          // duration: '12:00',
          allDay: false,
        });
      });
      res.send({
        code: 200,
        bookingData,
        arr,
      });
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for reservation of property by owner
  router.post('/addOwnerBooking', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log('addOwnerBooking', body);
      const ownerData = await DB.select('owner', { id: body.tokenData.userid });
      if (ownerData.length > 0) {
        const ownerBookingData = {
          guest: body.guest,
          adult: body.adult,
          children1: body.children1,
          children2: body.children2,
          perNight: body.perNight,
          night: body.night,
          amt: body.amt,
          discountType: body.discountType,
          discount: body.discount,
          accomodation: body.accomodation,
          totalAmount: body.totalAmount,
          deposit: body.deposit,
          depositType: body.depositType,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          notes1: body.notes,
          bookedUnit: body.unit,
          unitName: body.unitName,
          userId: ownerData[0].userId,
          unitTypeId: body.propertyId,
          propertyName: body.propertyName,
        };
        // await DB.update('bookingV2', { status: 'decline', statusColour: 'grey' }, { id: body.bookingId });
        const Id = await DB.insert('bookingV2', ownerBookingData);
        console.log(Id);
        res.send({
          code: 200,
          msg: 'Data saved successfully!',
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

  router.post('/uploadImg', ownerAuthCheck, async (req, res) => {
    console.log(req);
    const form = new multiparty.Form();
    form.parse(req, async (error, fields, files) => {
      if (error) throw new Error(error);
      try {
        const { ...body } = req.body;
        const { path } = files.file[0];
        const buffer = fs.readFileSync(path);
        const type = await fileType.fromBuffer(buffer);
        const timestamp = Date.now().toString();
        const fileName = `bucketFolder/${timestamp}-lg`;
        const data = await uploadImg(buffer, fileName, type);
        await DB.update('owner', { image: data.Location }, { id: body.tokenData.userid });
        res.send({
          code: 200,
          data,
          msg: 'Image upload successfully!',
        });
      } catch (e) {
        sentryCapture(e);
        console.log(e);
        res.send({
          code: 404,
          msg: 'Some error occured!',
        });
      }
    });
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

  // API for get all bookings
  router.post('/getAllBooking', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      const allBookingData = await DB.select('bookingV2', { bookedUnit: body.bookedUnit });
      res.send({
        code: 200,
        allBookingData,
      });
    } catch (e) {
      sentryCapture(e);
      console.log('error', e);
      res.send({
        code: 444,
        msg: 'Some error has occured!',
      });
    }
  });

  // API for delete booking
  router.post('/deleteBooking', ownerAuthCheck, async (req, res) => {
    try {
      const { ...body } = req.body;
      console.log(body);
      await DB.remove('bookingV2', { id: body.id });
      res.send({
        code: 200,
      });
    } catch (e) {
      sentryCapture(e);
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
