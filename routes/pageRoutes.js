const express = require('express');
const Donor = require('../models/Donor');
const BloodRequest = require('../models/BloodRequest');

const router = express.Router();

router.get('/', async (req, res) => {
  const [donorCount, openRequestCount, urgentRequests] = await Promise.all([
    Donor.countDocuments(),
    BloodRequest.countDocuments({ status: 'open' }),
    BloodRequest.find({ status: 'open', urgency: 'urgent' }).sort({ createdAt: -1 }).limit(5),
  ]);
  res.render('home', {
    title: 'CUET Blood Bank',
    donorCount,
    openRequestCount,
    urgentRequests,
  });
});

module.exports = router;
