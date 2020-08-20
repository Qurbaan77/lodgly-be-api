module.exports = {
  errorHandler: {
    reporting: true,
    mask: true,
    trace: false,
  },
  frontend: {
    app: {
      endpoint: 'https://%s.lodgly.com',
    },
    owners: {
      endpoint: 'https://lodglyowners.com',
    },
  },
};
