"use strict"
const AgenciesUserModel = require('../../models/AgenciesUsers');
const db = require('../../config/database')
const readUserData = async (_, reqData,ctx) => {
    try {
          console.log('readUserData called',reqData);
          AgenciesUserModel.findAll()
          .then(res=>{
              console.log('res==>',res);
          })
          .catch(e=>{
              console.log("error: ",e)
          })
          return{message:"readUserData called"}
    }
    catch (e) {
        throw new Error(catchMsg); //returning error message if  conditions   is not working 
    }
}

const validateAgencyToken = async (_,reqData,ctx) => {
    console.log("ctx", ctx.tokenData)
}

module.exports = {
    readUserData,
    validateAgencyToken
};