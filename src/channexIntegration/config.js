const getConfig = async (method, endpoint, token, payload) => {
  const data = JSON.stringify(payload);
  const config = {
    method: `${method}`,
    url: `https://staging.channex.io/api/v1/${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data,
  };
  return config;
};

module.exports = getConfig;
