const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { clientPath } = require('../config/default');

const { getConnection } = require('./services/database');

// routes
const usersRouter = require('./routes/users')();
const adminRouter = require('./routes/admin')();

const app = express();

// middlewares
app.use(
  cors({
    origin: [clientPath],
    credentials: true,
  }),
);
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

app.use('/admin', adminRouter);

app.get('/', async (req, res) => {
  const row = await getConnection().raw('SELECT 1000 as total');

  res.json({ data: row[0][0] });
});

module.exports = app;
