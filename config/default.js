module.exports = {
  environment: process.env.NODE_ENV,
  sentryDsn: process.env.SENTRY_DSN,
  clientPath: process.env.FRONTEND_APP,
  clientPath2: process.env.FRONTEND_APP2,
  userJwtKey: process.env.JWT_SECRET,
  stripeKey: 'sk_test_QGB0mJA7ijHknYtSZsuo2GLL',
  ID: 'AKIAXQT7I33QUFVO42Q5',
  SECRET: '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',
  BUCKET_NAME: 'lodgly.dev-files-eu-west-1',
  sendGridKey: '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',
  errorHandler: {
    reporting: false,
    mask: false,
  },
  database: {
    client: 'mysql2',
    useNullAsDefault: true,
    timezone: 'UTC',
    connection: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASS,
    },
  },
};
