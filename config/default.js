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
      accountConfirmation: '/company',
      changePassword: '/auth/password/change',
      resetPassword: '/auth/password/reset',
    },
  },
  ownerFrontend: {
    endpoint: 'https://lodglyowners.dev',
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
      apiKey: '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',
      templates: {
        en: {
          accountConfirmation: 'd-4a2fa88c47ef4aceb6be5805eab09c46',
          resetPassword: 'd-bb298999667342649f56ab13fe6dc055',
          ownerConfirmation: 'd-8a26674aae6b463c825663face51c180',
          subUserConfirmation: 'd-7683efe41a07402b969a4fb1f497905f',
          userResetPassword: 'd-e3c4a6289ca041f9bb65e5172417843b',
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
    accessKey: 'AKIAXQT7I33Q5CBXSSSM',
    accessSecretKey: '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',
    s3: {
      storageBucketName: 'storage.lodgly.dev-eu-west-1',
    },
  },
  serverPath: process.env.SERVER_PATH,
  sentry_dsn: process.env.SENTRY_DSN,
};
