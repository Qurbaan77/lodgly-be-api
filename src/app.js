const express = require('express');
const Sentry = require('@sentry/node');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('config');

// routes
const usersRouter = require('./routes/users')();
const ownerRouter = require('./routes/owner')();
const adminRouter = require('./routes/admin')();
const propertyRouter = require('./routes/properties')();
const bookingRouter = require('./routes/booking')();
const reservationRouter = require('./routes/reservation')();
const channelRouter = require('./routes/channelManagement')();

const app = express();
Sentry.init({
  dsn: config.get('sentry_dsn'),
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
// middlewares
app.use(Sentry.Handlers.requestHandler());
app.use(cors({ credentials: true, origin: true }));
app.use(express.limit('20M'));
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);

app.use(cookieParser('cookiesecret'));
app.use(express.static(path.join(__dirname, 'public')));

// routes middlewares
app.use('/users', usersRouter);

app.use('/owner', ownerRouter);

app.use('/properties', propertyRouter);

app.use('/booking', bookingRouter);

app.use('/reservation', reservationRouter);

app.use('/channel', channelRouter);

app.use('/admin', adminRouter);

app.get('/healthz', async (req, res) => {
  res.sendStatus(200);
});

module.exports = app;
