// imports
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const config = require('config');

// checking if request body is valid
const checkIfEmpty = (requestBody) => {
  const values = Object.values(requestBody);
  const isEmpty = values.filter((el) => !el);
  let isValid = true;
  if (isEmpty.length) {
    isValid = false;
  }
  return {
    isValid,
  };
};

// signing jwt token
const signJwt = (userid) => {
  let token;
  try {
    const tokenData = {
      userid,
    };
    token = jwt.sign(tokenData, config.get('guards.user.secret'), {
      expiresIn: config.get('guards.user.accessTokenTtl'),
    });
  } catch (e) {
    token = null;
  }
  return token;
};

// password hashing
const hashPassword = async (password) => {
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 10);
  } catch (e) {
    hashedPassword = null;
  }
  return hashedPassword;
};

// verify password hash
const verifyHash = async (password, passwordHash) => {
  let isPasswordValid;
  try {
    isPasswordValid = await bcrypt.compare(password, passwordHash);
  } catch (e) {
    console.log('error', e);
    isPasswordValid = null;
  }
  return isPasswordValid;
};

// verify jwt token
const verifyJwt = async (token) => {
  let isTokenValid;
  try {
    isTokenValid = await jwt.verify(token, config.get('guards.user.secret'));
  } catch (e) {
    console.log('error', e);
    isTokenValid = null;
  }
  return isTokenValid;
};

// verify owner jwt token
const verifyOwnerJwt = async (token) => {
  let isTokenValid;
  try {
    isTokenValid = await jwt.verify(token, config.get('guards.user.secret'));
  } catch (e) {
    console.log('error', e);
    isTokenValid = null;
  }
  return isTokenValid;
};

// signing jwt token for admin
const signJwtAdmin = (adminId) => {
  let token;
  try {
    const tokenData = {
      adminId,
    };
    token = jwt.sign(tokenData, config.get('guards.user.secret'), {
      expiresIn: config.get('guards.user.accessTokenTtl'),
    });
  } catch (e) {
    token = null;
  }
  return token;
};

const verifyJwtAdmin = async (token) => {
  let isTokenValid;
  try {
    isTokenValid = await jwt.verify(token, config.get('guards.user.secret'));
    if (isTokenValid) {
      return isTokenValid;
    }
  } catch (e) {
    console.log('error', e);
    isTokenValid = null;
  }
  return isTokenValid;
};

const storage = multer.diskStorage({
  fun1(req, file, cb) {
    cb(null, 'uploads');
  },
  fun2(req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

module.exports = {
  checkIfEmpty,
  signJwt,
  hashPassword,
  verifyHash,
  verifyJwt,
  verifyOwnerJwt,
  verifyJwtAdmin,
  signJwtAdmin,
  upload,
};
