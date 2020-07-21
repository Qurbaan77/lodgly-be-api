module.exports = {
  environment: process.env.NODE_ENV,
  sentryDsn: process.env.SENTRY_DSN,
  userJwtKey: process.env.JWT_SECRET,
  errorHandler: {
    reporting: true,
    trace: true,
    mask: true,
  },
  locales: {
    defaultLangCode: 'en',
    availableLanguages: ['de', 'en'],
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
  frontend: {
    endpoint: 'https://%s.lodgly.dev',
    paths: {
      accountConfirmation: '/auth/account/confirm',
      changePassword: '/auth/password/change',
      resetPassword: '/auth/password/reset',
    },
  },
  payments: {
    stripeApiKey: process.env.STRIPE_API_KEY,
  },
  mailing: {
    from: {
      name: 'lodgly',
      email: 'no-reply@lodgly.com',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      templates: {
        en: {
          accountConfirmation: undefined,
          resetPassword: undefined,
        },
      },
    },
  },
  guards: {
    user: {
      secret: process.env.JWT_USER_SECRET,
      accessTokenTtl: 86400,
      refreshTokenTtl: 1728000,
    },
  },
  aws: {
    accessKey: process.env.AWS_ACCESS_KEY,
    accessSecretKey: process.env.AWS_ACCESS_SECRET_KEY,
    s3: {
      storageBucketName: process.env.S3_BUCKET_NAME,
    },
  },
};
