const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');

// Test route to verify server is responding
router.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Payments API is working' });
});

// Create payment intent (Stripe / payment gateway)
router.post('/create-intent', (req, res, next) => {
  console.log('Payment intent request received:', {
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  next();
}, paymentsController.createIntent);

router.post('/confirm', paymentsController.confirm);

router.post('/refund', paymentsController.refund);

router.get('/:bookingId', paymentsController.getPaymentByBooking);

module.exports = router;
