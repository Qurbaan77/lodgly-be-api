const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

// const i = require('./routes/cronJob');

// routes
const usersRouter = require('./routes/users')();
const ownerRouter = require('./routes/owner')();
const adminRouter = require('./routes/admin')();

const app = express();

// middlewares
app.use(cors({ credentials: true, origin: true }));

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);
// i();

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
