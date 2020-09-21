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
    app: {
      endpoint: 'https://%s.lodgly.dev',
      paths: {
        accountConfirmation: '/company',
        changePassword: '/auth/password/change',
        resetPassword: '/auth/password/reset',
      },
    },
    owners: {
      endpoint: 'https://lodglyowners.dev',
      paths: {
        accountConfirmation: '/users/verify',
        changePassword: '/auth/password/change',
        resetPassword: '/reset',
      },
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
      apiKey: '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',
      templates: {
        en: {
          accountConfirmation: 'd-35afe33ef09d43508f087deacf699002',
          resetPassword: 'd-0eecb1a3826544fba19fb0e59d5f411b',
          ownerConfirmation: 'd-8393a5a760194102b9782b1dfac8c469',
          subUserConfirmation: 'd-0f36c198456c4bd3b48af5fb410b21a5',
          userResetPassword: 'd-e3c4a6289ca041f9bb65e5172417843b',
        },
      },
    },
  },
  guards: {
    user: {
      secret: process.env.JWT_USER_SECRET,
      accessTokenTtl: 360000,
      refreshTokenTtl: 1728000,
    },
  },
  aws: {
    accessKey: process.env.AWS_ACCESS_KEY,
    accessSecretKey: process.env.AWS_ACCESS_SECRET_KEY,
    s3: {
      storageBucketName: process.env.S3_STORAGE_BUCKET_NAME,
    },
  },
  serverPath: process.env.SERVER_PATH,
  sentry_dsn: process.env.SENTRY_DSN,
  COUPON_SECRET_KEY: 'secret-bb298999667342649f56ab13fe6dc055',
  RU_USER: process.env.RU_USER,
  RU_PASSWORD: process.env.RU_PASSWORD,
  CHANNEX_USER: process.env.CHANNEX_USER,
  CHANNEX_PASSWORD: process.env.CHANNEX_PASSWORD,
};
