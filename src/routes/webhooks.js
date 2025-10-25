const express = require('express');
const router = express.Router();
const { processFlightUpdate } = require('../services/airlineAdapter');
const { verifyStripeSignature } = require('../utils/stripeWebhook');
const Stripe = require('stripe');
let stripe = null;
try {
  stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
} catch (err) {
  stripe = null;
}
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { enqueueNotification } = require('../services/notificationService');

router.post('/airline', express.json(), async (req, res) => {
  const update = req.body;
  try {
    await processFlightUpdate(update);
    res.status(200).send('ok');
  } catch (err) {
    console.error('airline webhook error', err);
    res.status(500).send('error');
  }
});

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook not configured');
  }
  const sig = req.headers['stripe-signature'];
  try {
    const evt = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (evt.type === 'payment_intent.succeeded') {
      const pi = evt.data.object;
      const payment = await Payment.findOne({ paymentIntentId: pi.id });
      if (payment) {
        payment.status = 'succeeded';
        payment.raw = pi;
        await payment.save();
        const booking = await Booking.findById(payment.booking);
        if (booking) {
          booking.paymentStatus = 'paid';
          booking.paymentIntentId = pi.id;
          booking.status = 'confirmed';
          await booking.save();
          await enqueueNotification({
            userId: booking.user,
            bookingId: booking._id,
            type: 'payment_success',
            channels: ['email', 'sms'],
            subject: `Payment received for booking ${booking._id}`,
            body: `Your payment for booking ${booking._id} was successful.`,
            to: booking.contactInfo?.email,
          });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('stripe webhook error', err);
    res.status(400).send(`Webhook error: ${err.message}`);
  }
});

module.exports = router;
