const Sentry = require('@sentry/node');

const sentryCapture = (e) => {
  Sentry.captureException(e);
};

module.exports = sentryCapture;
