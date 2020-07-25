module.exports = {
  environment: process.env.NODE_ENV,
  sentryDsn: process.env.SENTRY_DSN,
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
      accountConfirmation: '/users/verify',
      changePassword: '/auth/password/change',
      resetPassword: '/auth/password/reset',
    },
  },
  ownerFrontend: {
    endpoint: 'https://d6pfwqgwkxggv.cloudfront.net',
    paths: {
      accountConfirmation: '/users/verify',
      changePassword: '/auth/password/change',
      resetPassword: '/reset',
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
          accountConfirmation: 'd-4a2fa88c47ef4aceb6be5805eab09c46',
          resetPassword: 'd-bb298999667342649f56ab13fe6dc055',
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
  serverPath: process.env.SERVER_PATH,
};
