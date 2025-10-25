// src/controllers/paymentsController.js
const Stripe = require('stripe');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { enqueueNotification } = require('../services/notificationService');

// Initialize Stripe
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized');
} catch (err) {
  console.error('Stripe init failed:', err.message);
  stripe = null;
}

// PayPal (optional)
let paypalClient = null;
try {
  const paypal = require('@paypal/paypal-server-sdk');
  const { Client, Environment } = paypal;
  if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    paypalClient = new Client({
      environment: process.env.NODE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
      clientCredentialsAuthCredentials: {
        oAuthClientId: process.env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET,
      },
    });
    console.log('PayPal initialized');
  }
} catch (_) {
  console.warn('PayPal not configured');
}

// Razorpay (optional)
let razorpay = null;
try {
  const Razorpay = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('Razorpay initialized');
  }
} catch (_) {
  console.warn('Razorpay not configured');
}

exports.createIntent = async (req, res) => {
  try {
    const { bookingId, paymentGateway = 'stripe', paymentMethod } = req.body;

    if (!bookingId) return res.status(400).json({ message: 'Booking ID required' });
    if (!paymentMethod) return res.status(400).json({ message: 'Payment method required' });

    const validMethods = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'bank_transfer'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const booking = await Booking.findById(bookingId).populate('user flight');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const amount = Math.round(booking.totalPrice * 100); // in paise/cents
    let paymentData = {};

    switch (paymentGateway) {
      case 'stripe':
        if (!stripe) return res.status(503).json({ message: 'Stripe not configured' });
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'inr',
          ...(paymentMethod === 'upi' ? { payment_method_types: ['upi'] } : { automatic_payment_methods: { enabled: true } }),
          metadata: { bookingId: booking._id.toString(), userId: booking.user?._id?.toString() }
        });
        paymentData = { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, raw: paymentIntent };
        break;

      case 'paypal':
        if (!paypalClient) return res.status(503).json({ message: 'PayPal not configured' });
        const order = await paypalClient.Orders.create({
          intent: 'CAPTURE',
          purchase_units: [{ amount: { currency_code: 'INR', value: booking.totalPrice.toString() }, reference_id: booking._id.toString() }],
        });
        paymentData = { paymentIntentId: order.id, clientSecret: null, raw: order };
        break;

      case 'razorpay':
        if (!razorpay) return res.status(503).json({ message: 'Razorpay not configured' });
        const orderRazor = await razorpay.orders.create({
          amount,
          currency: 'INR',
          receipt: `booking_${booking._id}`,
          notes: { bookingId: booking._id.toString(), userId: booking.user?._id?.toString() },
        });
        paymentData = { paymentIntentId: orderRazor.id, clientSecret: null, raw: orderRazor };
        break;

      case 'bank_transfer':
        const referenceId = `BT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        paymentData = {
          paymentIntentId: referenceId,
          clientSecret: null,
          raw: {
            referenceId,
            accountDetails: {
              bankName: process.env.BANK_NAME || 'Example Bank',
              accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
              ifscCode: process.env.BANK_IFSC_CODE || 'EXBK0001234',
            },
          },
        };
        break;

      default:
        return res.status(400).json({ message: 'Unsupported gateway' });
    }

    // Save payment
    const payment = await Payment.create({
      booking: booking._id,
      user: booking.user?._id,
      paymentGateway,
      paymentMethod,
      paymentIntentId: paymentData.paymentIntentId,
      amount: booking.totalPrice,
      currency: 'INR',
      status: 'created',
      metadata: { paymentGateway, paymentMethod },
      raw: paymentData.raw,
    });

    res.json({
      paymentId: payment._id,
      paymentGateway,
      clientSecret: paymentData.clientSecret,
      paymentIntentId: paymentData.paymentIntentId,
      ...(paymentGateway === 'bank_transfer' ? { bankDetails: paymentData.raw.accountDetails } : {}),
    });
  } catch (err) {
    console.error('createIntent err', err);
    res.status(500).json({ message: 'Failed to create payment intent', error: err.message });
  }
};

exports.confirm = async (req, res) => {
  try {
    const { paymentIntentId, bookingId } = req.body;
    if (!paymentIntentId || !bookingId) return res.status(400).json({ message: 'Missing paymentIntentId or bookingId' });

    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    // For Stripe, retrieve intent
    if (payment.paymentGateway === 'stripe') {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      payment.status = intent.status === 'succeeded' ? 'succeeded' : intent.status;
      payment.raw = intent;
      await payment.save();

      if (intent.status === 'succeeded') {
        const booking = await Booking.findById(bookingId);
        booking.paymentStatus = 'paid';
        booking.paymentIntentId = paymentIntentId;
        booking.status = 'confirmed';
        await booking.save();

        await enqueueNotification({
          userId: booking.user,
          bookingId: booking._id,
          type: 'booking_confirm',
          channels: ['email', 'sms'],
          subject: `Booking confirmed — ${booking._id}`,
          body: `Your booking for flight ${booking.flight} is confirmed. Booking ref: ${booking._id}.`,
          to: booking.contactInfo?.email,
        });
      }
    }

    // For UPI / other methods, mark as succeeded after manual confirmation
    else if (['upi', 'bank_transfer', 'razorpay', 'paypal'].includes(payment.paymentMethod)) {
      payment.status = 'succeeded';
      await payment.save();

      const booking = await Booking.findById(bookingId);
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      await booking.save();
    }

    res.json({ success: true, paymentStatus: payment.status });
  } catch (err) {
    console.error('confirm payment err', err);
    res.status(500).json({ message: 'Failed to confirm payment', error: err.message });
  }
};

exports.refund = async (req, res) => {
  try {
    const { bookingId, paymentIntentId, amount, reason } = req.body;
    if (!bookingId && !paymentIntentId) {
      return res.status(400).json({ message: 'Provide bookingId or paymentIntentId' });
    }

    let payment;
    if (paymentIntentId) {
      payment = await Payment.findOne({ paymentIntentId });
    } else {
      payment = await Payment.findOne({ booking: bookingId }).sort({ createdAt: -1 });
    }
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    const refundAmountInCents = typeof amount === 'number' ? Math.round(amount * 100) : undefined;

    if (payment.paymentGateway === 'stripe' && stripe) {
      const refund = await stripe.refunds.create({
        payment_intent: payment.paymentIntentId,
        amount: refundAmountInCents,
      });

      payment.status = refundAmountInCents && refundAmountInCents < Math.round((payment.amount || 0) * 100)
        ? 'partially_refunded'
        : 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = typeof amount === 'number' ? amount : payment.amount;
      payment.refundReason = reason || 'Customer requested refund';
      payment.refundedAt = new Date();
      payment.raw = { ...(payment.raw || {}), refund };
      await payment.save();
    } else {
      payment.status = typeof amount === 'number' && amount < (payment.amount || 0)
        ? 'partially_refunded'
        : 'refunded';
      payment.refundAmount = typeof amount === 'number' ? amount : payment.amount;
      payment.refundReason = reason || 'Customer requested refund';
      payment.refundedAt = new Date();
      await payment.save();
    }

    const booking = await Booking.findById(payment.booking);
    if (booking) {
      booking.paymentStatus = 'refunded';
      await booking.save();
    }

    await enqueueNotification({
      userId: payment.user,
      bookingId: payment.booking,
      type: 'payment_refund',
      channels: ['email'],
      subject: `Refund processed — ${bookingId || paymentIntentId}`,
      body: `Your refund has been processed for booking ${payment.booking}. Amount: ₹${payment.refundAmount}.`,
      to: booking?.contactInfo?.email,
    });

    return res.json({
      success: true,
      status: payment.status,
      refundId: payment.refundId || null,
      refundAmount: payment.refundAmount,
    });
  } catch (err) {
    console.error('refund err', err);
    return res.status(500).json({ message: 'Failed to process refund', error: err.message });
  }
};

exports.getPaymentByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required' });

    const payments = await Payment.find({ booking: bookingId }).sort({ createdAt: -1 });
    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: 'No payments found for booking' });
    }

    return res.json({ payment: payments[0], payments });
  } catch (err) {
    console.error('getPaymentByBooking err', err);
    return res.status(500).json({ message: 'Failed to fetch payment', error: err.message });
  }
};
