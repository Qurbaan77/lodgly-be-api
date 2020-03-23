const jwt = require('jsonwebtoken');
const bcrypt =  require('bcryptjs');
const {userJwtKey} = require('../config/key')

//checking if request body is valid
 const checkIfEmpty = (requestBody) => {
    const values = Object.values(requestBody);
    let isEmpty = values.filter(el => !el)
    return {
        isValid: isEmpty.length > 0 ? false : true
    }
}

//signing jwt token
 const signJwt = userid => {
    let token;
    try {
        const tokenData = {
            userid
        }
        token = jwt.sign(tokenData, userJwtKey, {
            expiresIn: "100h"
        })
    }
    catch (e) {
        token = null
    }
    return token;
}

//password hashing
 const hashPassword = password => {
    return new Promise(async (resolve, reject) => {
        try {
            const hashedPassword = await bcrypt.hash(password, 10)
            resolve(hashedPassword)
        }
        catch (e) {
            reject(false)
        }
    })
}

//verify password hash
 const verifyHash = (password, passwordHash) => {
    return new Promise(async (resolve, reject) => {
        try {
            const isPasswordValid = await bcrypt.compare(password, passwordHash)
            resolve(isPasswordValid)
        }
        catch (e) {
            reject(false)
        }
    })
}

//verify jwt token
 const verifyJwt = token => {
    return new Promise(async (resolve, reject) => {
        try {
            const isTokenValid = await jwt.verify(token, userJwtKey)
            if (isTokenValid) {
                resolve(isTokenValid)
            }
        }
        catch (e) {
            reject(false)
        }
    })
}


//signing jwt token for admin
 const signJwtAdmin = adminId => {
    let token;
    try {
        const tokenData = {
            adminId
        }
        token = jwt.sign(tokenData, adminJwtKey, {
            expiresIn: "100h"
        })
    }
    catch (e) {
        token = null
    }
    return token;
}

 const verifyJwtAdmin = token => {
    return new Promise(async (resolve, reject) => {
        try {
            const isTokenValid = await jwt.verify(token, adminJwtKey)
            if (isTokenValid) {
                resolve(isTokenValid)
            }
        }
        catch (e) {
            reject(false)
        }
    })
}


module.exports = {
    checkIfEmpty,
    signJwt,
    hashPassword,
    verifyHash,
    verifyJwt,
    signJwtAdmin
}