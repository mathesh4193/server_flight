// src/routes/paymentsRoutes.js
const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log('Payment request received:', {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  next();
};

// Test route to verify server is responding
router.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Payments API is working' });
});

// Create payment intent (Stripe / UPI / Bank Transfer)
router.post('/create-intent', logRequest, paymentsController.createIntent);

// Confirm payment (Stripe / UPI)
router.post('/confirm', logRequest, paymentsController.confirm);

// Refund payment
router.post('/refund', logRequest, paymentsController.refund);

// Get payment info by booking
router.get('/:bookingId', logRequest, paymentsController.getPaymentByBooking);

module.exports = router;
