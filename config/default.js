module.exports = {
  environment: process.env.NODE_ENV,
  sentryDsn: process.env.SENTRY_DSN,
  clientPath: process.env.FRONTEND_APP,
  clientPath2: process.env.FRONTEND_APP2,
  userJwtKey: process.env.JWT_SECRET,
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
