const Stripe = require('stripe');
const Payment = require('../models/Payment');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a payment intent for a booking
 * @param {Number} amount - Total amount in smallest currency unit (e.g., cents)
 * @param {String} currency - Currency code, e.g., 'usd', 'inr'
 * @param {Object} metadata - Additional data to attach to payment (like bookingId, userId)
 * @returns {Object} Stripe PaymentIntent object
 */
exports.createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
    });
    return paymentIntent;
  } catch (err) {
    console.error('Error creating payment intent:', err);
    throw err;
  }
};

/**
 * Confirm an existing payment intent
 * @param {String} paymentIntentId - Stripe PaymentIntent ID
 * @returns {Object} Confirmed payment intent
 */
exports.confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    return paymentIntent;
  } catch (err) {
    console.error('Error confirming payment:', err);
    throw err;
  }
};

/**
 * Refund a payment
 * @param {String} paymentIntentId - Stripe PaymentIntent ID to refund
 * @returns {Object} Refund object
 */
exports.refundPayment = async (paymentIntentId) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
    return refund;
  } catch (err) {
    console.error('Error processing refund:', err);
    throw err;
  }
};

/**
 * Save payment record to database
 * @param {Object} data - Payment info (userId, bookingId, amount, status, paymentIntentId)
 * @returns {Object} Saved payment document
 */
exports.savePaymentRecord = async (data) => {
  try {
    const payment = await Payment.create(data);
    return payment;
  } catch (err) {
    console.error('Error saving payment record:', err);
    throw err;
  }
};

/**
 * Get payment details by booking
 * @param {String} bookingId - ID of the booking
 * @returns {Object} Payment record from DB
 */
exports.getPaymentByBooking = async (bookingId) => {
  try {
    const payment = await Payment.findOne({ bookingId });
    return payment;
  } catch (err) {
    console.error('Error fetching payment record:', err);
    throw err;
  }
};
