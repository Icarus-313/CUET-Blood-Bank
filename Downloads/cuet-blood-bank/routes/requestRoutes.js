const express = require('express');
const rateLimit = require('express-rate-limit');
const requestController = require('../controllers/requestController');

const router = express.Router();

// Prevent spamming urgent-request emails to every donor.
const createRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests submitted from this device. Please try again later.',
});

router.get('/requests/new', requestController.showNewRequest);
router.post('/requests/new', createRequestLimiter, requestController.createRequest);
router.get('/requests', requestController.listRequests);
router.post('/requests/:id/fulfilled', requestController.markFulfilled);

module.exports = router;
