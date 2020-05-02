const { verifyJwt, verifyJwtAdmin } = require('../functions');

const userAuthCheck = async (req, res, next) => {
  try {
    const cookie = req.signedCookies;
    if (cookie) {
      const isCookieValid = await verifyJwt(cookie.token);
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

module.exports = {
  userAuthCheck,
  adminAuthCheck,
  adminAuthCheckParam,
};
