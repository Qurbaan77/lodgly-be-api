"use strict"
const AgenciesUserModel = require('../../models/AgenciesUsers');
const db = require('../../config/database');
const {
    checkIfEmpty,
    signJwt,
    hashPassword,
    verifyHash }  = require ('../../function');
const crypto = require('crypto')

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
                  verificationhex:hash
              }
            const res = await AgenciesUserModel.create(payload);

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


module.exports = {
    registerAgencies,
    login
};