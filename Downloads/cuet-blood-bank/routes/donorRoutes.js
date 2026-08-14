const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const donorController = require('../controllers/donorController');

const router = express.Router();

const contactRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: { error: 'Too many contact requests from this device. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth-protected
router.get('/dashboard', requireAuth, donorController.dashboard);
router.get('/profile/edit', requireAuth, donorController.showEditProfile);
router.post('/profile/edit', requireAuth, donorController.updateProfile);
router.post('/profile/donate', requireAuth, donorController.recordDonation);
router.post('/profile/toggle-availability', requireAuth, donorController.toggleAvailability);
router.post('/api/donors/me/location', requireAuth, donorController.updateLocation);

// Public
router.get('/search', donorController.search);
router.get('/api/donors/search', donorController.searchApi);
router.post('/api/donors/:id/request-contact', contactRequestLimiter, donorController.requestContact);

module.exports = router;
