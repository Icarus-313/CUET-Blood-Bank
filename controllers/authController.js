const { validationResult } = require('express-validator');
const Donor = require('../models/Donor');
const { signToken } = require('../middleware/auth');

const COOKIE_NAME = process.env.COOKIE_NAME || 'bb_token';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };
}

function isAllowedEmail(email) {
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || '').toLowerCase().trim();
  if (!domain) return true; // domain restriction disabled if unset
  return email.toLowerCase().trim().endsWith('@' + domain);
}

exports.showRegister = (req, res) => {
  res.render('register', {
    title: 'Register as Donor',
    bloodGroups: Donor.BLOOD_GROUPS,
    allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN,
    errors: [],
    old: {},
  });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  const renderErrors = errors.array().map((e) => e.msg);

  if (!isAllowedEmail(req.body.email || '')) {
    renderErrors.push(`Registration is only open to @${process.env.ALLOWED_EMAIL_DOMAIN} emails.`);
  }

  if (renderErrors.length) {
    return res.status(400).render('register', {
      title: 'Register as Donor',
      bloodGroups: Donor.BLOOD_GROUPS,
      allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN,
      errors: renderErrors,
      old: req.body,
    });
  }

  try {
    const existing = await Donor.findOne({ email: req.body.email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).render('register', {
        title: 'Register as Donor',
        bloodGroups: Donor.BLOOD_GROUPS,
        allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN,
        errors: ['An account with this email already exists. Try logging in instead.'],
        old: req.body,
      });
    }

    const donor = await Donor.create({
      name: req.body.name,
      email: req.body.email.toLowerCase().trim(),
      password: req.body.password,
      phone: req.body.phone,
      bloodGroup: req.body.bloodGroup,
      department: req.body.department || '',
      batch: req.body.batch || '',
      addressLabel: req.body.addressLabel || '',
    });

    const token = signToken(donor._id);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.redirect('/dashboard?welcome=1');
  } catch (err) {
    console.error(err);
    res.status(500).render('register', {
      title: 'Register as Donor',
      bloodGroups: Donor.BLOOD_GROUPS,
      allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN,
      errors: ['Something went wrong. Please try again.'],
      old: req.body,
    });
  }
};

exports.showLogin = (req, res) => {
  res.render('login', { title: 'Log In', errors: [], old: {} });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const donor = await Donor.findOne({ email: (email || '').toLowerCase().trim() }).select('+password');
    if (!donor || !(await donor.comparePassword(password || ''))) {
      return res.status(400).render('login', {
        title: 'Log In',
        errors: ['Invalid email or password.'],
        old: { email },
      });
    }
    const token = signToken(donor._id);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('login', { title: 'Log In', errors: ['Something went wrong.'], old: { email } });
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/');
};

exports.isAllowedEmail = isAllowedEmail;
