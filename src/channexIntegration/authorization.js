const axios = require('axios');

const auth = async (user, password) => {
  console.log(user, password);
  const payload = {
    user: {
      email: user,
      password,
    },
  };
  const data = JSON.stringify(payload);
  const config = {
    method: 'post',
    url: 'https://staging.channex.io/api/v1/sign_in',
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  };
  const res = await axios(config);
  return res.data.data.attributes.token;
};

module.exports = auth;
