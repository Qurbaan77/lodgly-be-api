const config = require('config');
const { verifyJwt, verifyJwtAdmin, verifyOwnerJwt } = require('../functions');

const userAuthCheck = async (req, res, next) => {
  try {
    const token = req.headers['x-custom-header'];
    // const cookie = req.signedCookies;
    if (token) {
      // console.log('token', cookie.token);
      const isCookieValid = await verifyJwt(token);
      if (isCookieValid) {
        req.body.tokenData = isCookieValid;
        next();
      } else {
        res.send({
          code: 400,
          msg: 'Authentication is required',
        });
      }
    }
  } catch (e) {
    res.send({
      code: 444,
      msg: 'Some error has occured!',
    });
  }
};

const getAuthCheck = async (req, res, next) => {
  try {
    const token = req.headers['x-custom-header'];
    console.log(token);
    const isTokenValid = await verifyJwt(token);
    console.log(isTokenValid);
    if (isTokenValid) {
      req.body.tokenData = isTokenValid;
      next();
    } else {
      res.send({
        code: 400,
        msg: 'Authentication is required',
      });
    }
  } catch (e) {
    res.send({
      code: 444,
      msg: 'Some error has occured!',
    });
  }
};

const ownerAuthCheck = async (req, res, next) => {
  try {
    const cookie = req.signedCookies;
    if (cookie) {
      const isCookieValid = await verifyOwnerJwt(cookie.token);
      if (isCookieValid) {
        req.body.tokenData = isCookieValid;
        next();
      } else {
        res.send({
          code: 400,
          msg: 'Authentication is required',
        });
      }
    }
  } catch (e) {
    res.send({
      code: 444,
      msg: 'Some error has occured!',
    });
  }
};

const adminAuthCheck = async (req, res, next) => {
  try {
    const cookie = req.signedCookies.adminToken;
    if (cookie) {
      const isCookieValid = await verifyJwtAdmin(cookie);
      if (isCookieValid) {
        req.body.tokenData = isCookieValid;
        next();
      } else {
        res.send({
          code: 400,
          msg: 'Authentication is required',
        });
      }
    }
  } catch (e) {
    console.log(e);
    res.send({
      code: 444,
      msg: 'Token Expired!',
    });
  }
};

const adminAuthCheckParam = async (req, res, next) => {
  const tokenData = await verifyJwtAdmin(req.params.adminToken);
  if (tokenData) {
    next();
  } else {
    res.status(200).json({
      code: 400,
      msg: 'Not Authenticated',
    });
  }
};

// middleware to check coupon generation authorizatiomn
const checkAccess = async (req, res, next) => {
  const headerSecret = req.headers['x-auth-check'];
  const couponSecret = config.get('COUPON_SECRET_KEY');
  if (headerSecret === couponSecret) {
    next();
  } else {
    res.send({
      code: 401,
      msg: 'Unauthorize request',
    });
  }
};

module.exports = {
  userAuthCheck,
  ownerAuthCheck,
  adminAuthCheck,
  adminAuthCheckParam,
  checkAccess,
  getAuthCheck,
};
