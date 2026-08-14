const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/register', authController.showRegister);
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('bloodGroup').notEmpty().withMessage('Blood group is required.'),
  ],
  authController.register
);

router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
