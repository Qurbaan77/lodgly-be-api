"use strict"
const AgenciesUserModel = require('../../models/AgenciesUsers');
const db = require('../../config/database');
const {
    checkIfEmpty,
    signJwt,
    hashPassword,
    verifyHash }  = require ('../../function');
const crypto = require('crypto');
const smtpTransport = require ('nodemailer-smtp-transport');
const nodemailer = require ("nodemailer");
const {clientPath} = require("../../config/key");


const registerAgencies = async (_, reqData,ctx) => {
    try {
          console.log('registerAgencies called',reqData);
          const isExist = await AgenciesUserModel.findAll({
            where: {email: reqData.data.email}
          })
          console.log("isExist",isExist);
          if (!isExist.length) {
            const hashedPassword = await hashPassword(reqData.data.password);
            const hash = crypto
              .createHmac("sha256", "verificationHash")
              .update(reqData.data.email)
              .digest("hex");

              const payload = {
                  email:reqData.data.email,
                  username: reqData.data.username,
                  mob:reqData.data.mob,
                  password:hashedPassword,
                  package:reqData.data.package,
                  verificationhex:hash
              }
            const res = await AgenciesUserModel.create(payload);

            let transporter = nodemailer.createTransport(smtpTransport({
                host: 'mail.websultanate.com',
                port: 587,
                auth: {
                  user: 'developer@websultanate.com',
                  pass: 'Raviwbst@123'
                },
                tls: {
                  rejectUnauthorized: false
                },
                debug: true
              }));

              let mailOptions = {
                from: "developer@websultanate.com",
                to: res.dataValues.email,
                subject: "Please verify your email",
                text: `Please click on this link to verify your email address ${clientPath}/verify/${
                  res.dataValues.verificationhex
                  }`
              };
  
              transporter.sendMail(mailOptions);
    

            console.log('response ',res.dataValues);
            return res.dataValues
          } else {
                throw new Error('Email already exist')
          }
          
    }
    catch (e) {
        console.log("error",e);
        throw new Error(e); 
    }
}

const verifyUser = async(_,reqData,ctx) => {
    try {
        console.log("verifyUser api called : ", reqData)
        const verificationhex = reqData.hex;
        const userHex = await AgenciesUserModel.findOne({
            where:{
                verificationhex,
                isvalid: false
            }
        });
        if (userHex) {
          await AgenciesUserModel.update(
            
            {
              isvalid: true
            },
            {
                where:{id: userHex.dataValues.id},
                plain:true,
                returning:true
            }
          );
          return {message:"User verified successfully"}
        } else {
          throw new Error('Verification hex not found')
        }
      } catch (e) {
        console.log("error",e);
        throw new Error(e); 
      }
}

const login = async(_,reqData,ctx)=>{
    try {
        console.log("login called",reqData )
        const { email, password } = reqData.data;
        const isUserExists = await AgenciesUserModel.findOne({
            where:{email}
          });
          console.log("user data ==> ",isUserExists)
        if (isUserExists) {
            const isPasswordValid = await verifyHash(
                password,
                isUserExists.dataValues.password
            );
            if (isPasswordValid) {
                const token = signJwt(isUserExists.dataValues.id);
                console.log('token',token)
                return{token}
            } else {
                throw new Error('Invalid Login Details!')
            }
        } else {
            throw new Error('User not found!')
        }
    } catch (e) {
        console.log("error",e);
        throw new Error(e); 
    }
}

const forgetPassword = async(_,reqData,ctx)=>{
    console.log("forgetPassword api called =>",reqData)
    try {
      const { newpassword, hex } = reqData.data;
      const { isValid } = checkIfEmpty(reqData.data);
      if (isValid) {
        const userData = await AgenciesUserModel.findOne({
          forgetPassHex: hex
        });
        if (userData) {
          const newhashedPassword = await hashPassword(newpassword);
          if (newhashedPassword) {
            await AgenciesUserModel.update(
              {
                password: newhashedPassword,
                forgetPassHex: ""
              },
              {
                where: {email:userData.dataValues.email},
                returning: true, // needed for affectedRows to be populated
                plain: true // makes sure that the returned instances are just plain objects
              }
            );
            return {message:"Password updated successfully!"}
          }
        } else {
          throw new Error('Wrong token')
        }
      } else {
        throw new Error('Invalid input')
      }
    } catch (e) {
        console.log("error",e);
        throw new Error(e); 
    }
}

const resetPassword = async(_,reqData,ctx)=>{
    try {
        const { isValid } = checkIfEmpty(reqData);
        const { email } = reqData;
        if (isValid) {
          const userData = await AgenciesUserModel.findOne({
            where:{email}
          });
          if (userData) {
            const forgetPassHex = crypto
              .createHmac("sha256", "forgetPasswordHex")
              .update(userData.dataValues.email)
              .digest("hex");
            await AgenciesUserModel.update(
              {
                forgetPassHex
              },
              {
                where: {email},
                returning: true, // needed for affectedRows to be populated
                plain: true // makes sure that the returned instances are just plain objects
              }
            );
            let transporter = nodemailer.createTransport(smtpTransport({
              host: 'mail.websultanate.com',
              port: 587,
              auth: {
                user: 'developer@websultanate.com',
                pass: 'Raviwbst@123'
              },
              tls: {
                rejectUnauthorized: false
              },
              debug: true
            }));
  
            let mailOptions = {
              from: "developer@websultanate.com",
              to: userData.dataValues.email,
              subject: "Reset your password",
              text: `Please click on this link to reset your password ${clientPath}/forgetpassword?hh=${forgetPassHex}`
            };
  
            transporter.sendMail(mailOptions);
  
            return {message:"Please check your email for forget password link!"}
          } else {
            throw new Error('Email not found!')
          }
        } else {
            throw new Error('Invalid input')
        }
      } catch (e) {
        console.log("error",e);
        throw new Error(e);
      }
}




module.exports = {
    registerAgencies,
    verifyUser,
    login,
    forgetPassword,
    resetPassword
};