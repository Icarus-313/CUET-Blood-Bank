const jwt = require('jsonwebtoken');
const Donor = require('../models/Donor');

function signToken(donorId) {
  return jwt.sign({ id: donorId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function getTokenFromReq(req) {
  const cookieName = process.env.COOKIE_NAME || 'bb_token';
  if (req.cookies && req.cookies[cookieName]) return req.cookies[cookieName];
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
}

// Populates req.donor if a valid token is present. Never blocks the request.
async function attachDonor(req, res, next) {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donor = await Donor.findById(decoded.id);
    if (donor) {
      req.donor = donor;
      res.locals.donor = donor;
    }
    next();
  } catch (err) {
    next();
  }
}

// Blocks the request unless a valid donor is authenticated.
function requireAuth(req, res, next) {
  if (!req.donor) {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }
    return res.redirect('/login');
  }
  next();
}

module.exports = { signToken, attachDonor, requireAuth };
