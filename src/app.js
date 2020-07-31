const express = require('express');
const Sentry = require('@sentry/node');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('config');

const { i } = require('./routes/cronJob');

// routes
const usersRouter = require('./routes/users')();
const ownerRouter = require('./routes/owner')();
const adminRouter = require('./routes/admin')();

const app = express();
Sentry.init({ dsn: config.get('sentry_dsn') });
// middlewares
app.use(Sentry.Handlers.requestHandler());
app.use(cors({ credentials: true, origin: true }));

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);
i();

app.use(cookieParser('cookiesecret'));
app.use(express.static(path.join(__dirname, 'public')));

// routes middlewares
app.use('/users', usersRouter);

app.use('/owner', ownerRouter);

app.use('/admin', adminRouter);

app.get('/healthz', async (req, res) => {
  res.sendStatus(200);
});

module.exports = app;
