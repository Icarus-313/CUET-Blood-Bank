require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const connectDB = require('./config/db');
const { attachDonor } = require('./middleware/auth');

const pageRoutes = require('./routes/pageRoutes');
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const requestRoutes = require('./routes/requestRoutes');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Core middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Make current donor + app name available to every view
app.use(attachDonor);
app.use((req, res, next) => {
  res.locals.appName = process.env.APP_NAME || 'CUET Blood Bank';
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.use('/', pageRoutes);
app.use('/', authRoutes);
app.use('/', donorRoutes);
app.use('/', requestRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('500', { title: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`${process.env.APP_NAME || 'CUET Blood Bank'} running on http://localhost:${PORT}`);
  });
}

// Only auto-start the server (and connect to MongoDB) when this file is run
// directly, e.g. `node server.js`. This keeps `app` importable/testable
// without needing a live database connection.
if (require.main === module) {
  start();
}

module.exports = app;
