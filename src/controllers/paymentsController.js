// src/controllers/paymentsController.js
const Stripe = require('stripe');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

console.log('Environment check - STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
console.log('Environment check - STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length);

let stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe initialized successfully');
} catch (error) {
  console.error('Stripe initialization failed:', error);
  stripe = null;
}
const { enqueueNotification } = require('../services/notificationService');

// PayPal SDK
const paypal = require('@paypal/paypal-server-sdk');
const { Client, Environment } = paypal;
let paypalClient;

if (process.env.NODE_ENV === 'production') {
  paypalClient = new Client({
    environment: Environment.Production,
    clientCredentialsAuthCredentials: {
      oAuthClientId: process.env.PAYPAL_CLIENT_ID,
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
    }
  });
} else {
  paypalClient = new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: process.env.PAYPAL_CLIENT_ID,
      oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET
    }
  });
}

// Razorpay
const Razorpay = require('razorpay');
const razorpay = process.env.RAZORPAY_KEY_ID ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
}) : null;

exports.createIntent = async (req, res) => {
  try {
    const { bookingId, paymentGateway = 'stripe', paymentMethod } = req.body;
    
    // Validate payment method
    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method is required' });
    }
    
    // Map payment method to valid values
    const validPaymentMethods = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'bank_transfer'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: `Invalid payment method. Valid methods: ${validPaymentMethods.join(', ')}` });
    }
    
    console.log('Stripe key status:', process.env.STRIPE_SECRET_KEY ? 'Present' : 'Missing');
    console.log('Stripe key length:', process.env.STRIPE_SECRET_KEY?.length);
    console.log('Stripe key prefix:', process.env.STRIPE_SECRET_KEY?.substring(0, 15));
    
    // Validate booking ID format
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }
    
    console.log('Looking for booking with ID:', bookingId);
    console.log('Booking ID type:', typeof bookingId);
    
    const booking = await Booking.findById(bookingId).populate('user flight');
    console.log('Booking found:', booking ? 'Yes' : 'No');
    if (!booking) {
      console.log('Booking not found for ID:', bookingId);
      return res.status(404).json({ message: 'Booking not found' });
    }

    const amount = Math.round(booking.totalPrice * 100); // cents/paise
    let paymentData = {};
    
    // Process based on payment gateway
    switch (paymentGateway) {
      case 'stripe':
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'inr',
          metadata: { 
            bookingId: booking._id.toString(), 
            userId: booking.user?._id?.toString() 
          },
          automatic_payment_methods: { enabled: true }
        });
        
        paymentData = {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          raw: paymentIntent
        };
        break;
        
      case 'paypal':
        // Create PayPal order using the new SDK structure
        const response = await paypalClient.Orders.create({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'INR',
              value: booking.totalPrice.toString()
            },
            reference_id: booking._id.toString()
          }]
        });
        
        paymentData = {
          paymentIntentId: response.id,
          clientSecret: null,
          raw: response
        };
        break;
        
      case 'razorpay':
        if (!razorpay) {
          return res.status(400).json({ message: 'Razorpay is not configured' });
        }
        
        const razorpayOrder = await razorpay.orders.create({
          amount: amount,
          currency: 'INR',
          receipt: `booking_${booking._id}`,
          notes: {
            bookingId: booking._id.toString(),
            userId: booking.user?._id?.toString()
          }
        });
        
        paymentData = {
          paymentIntentId: razorpayOrder.id,
          clientSecret: null,
          raw: razorpayOrder
        };
        break;
        
      case 'bank_transfer':
        // Generate a unique reference number for bank transfer
        const referenceId = `BT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        paymentData = {
          paymentIntentId: referenceId,
          clientSecret: null,
          raw: {
            referenceId,
            accountDetails: {
              bankName: process.env.BANK_NAME || 'Example Bank',
              accountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
              ifscCode: process.env.BANK_IFSC_CODE || 'EXBK0001234'
            }
          }
        };
        break;
        
      default:
        return res.status(400).json({ message: 'Unsupported payment gateway' });
    }

    // Save payment record
    const payment = await Payment.create({
      booking: booking._id,
      user: booking.user?._id,
      paymentGateway,
      paymentMethod,
      paymentIntentId: paymentData.paymentIntentId,
      amount: booking.totalPrice,
      currency: 'INR',
      status: 'created',
      metadata: {
        paymentGateway,
        paymentMethod
      },
      raw: paymentData.raw,
    });

    res.json({ 
      paymentId: payment._id,
      paymentGateway,
      clientSecret: paymentData.clientSecret,
      paymentIntentId: paymentData.paymentIntentId,
      ...('bank_transfer' === paymentGateway ? { bankDetails: paymentData.raw.accountDetails } : {})
    });
  } catch (err) {
    console.error('createIntent err:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    if (err.type) console.error('Error type:', err.type);
    if (err.code) console.error('Error code:', err.code);
    if (err.raw) console.error('Error raw:', err.raw);
    res.status(500).json({ message: 'Failed to create payment intent', error: err.message });
  }
};

exports.refund = async (req, res) => {
  try {
    const { paymentIntentId, bookingId, reason } = req.body;
    
    // Find payment record
    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });
    
    // Process refund through Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: reason || 'requested_by_customer'
    });
    
    // Update payment status
    payment.status = 'refunded';
    payment.refundId = refund.id;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await payment.save();
    
    // Update booking status
    const booking = await Booking.findById(bookingId);
    if (booking) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'refunded';
      await booking.save();
      
      // Send notification
      await enqueueNotification({
        userId: booking.user,
        bookingId: booking._id,
        type: 'booking_refund',
        channels: ['email', 'sms'],
        subject: `Booking refunded — ${booking._id}`,
        body: `Your booking for flight ${booking.flight} has been cancelled and refunded. Refund ID: ${refund.id}`,
        to: booking.contactInfo?.email,
      });
    }
    
    res.json({ success: true, refundId: refund.id });
  } catch (err) {
    console.error('refund payment err', err);
    res.status(500).json({ message: 'Failed to process refund' });
  }
};

exports.getPaymentByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const payment = await Payment.findOne({ booking: bookingId });
    if (!payment) return res.status(404).json({ message: 'Payment not found for this booking' });
    
    res.json({
      id: payment._id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      paymentGateway: payment.paymentGateway,
      paymentIntentId: payment.paymentIntentId,
      refundId: payment.refundId,
      refundedAt: payment.refundedAt
    });
  } catch (err) {
    console.error('get payment err', err);
    res.status(500).json({ message: 'Failed to retrieve payment information' });
  }
};

exports.confirm = async (req, res) => {
  try {
    const { paymentIntentId, bookingId } = req.body;
    // Verify with Stripe
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const payment = await Payment.findOne({ paymentIntentId });
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    // Update Payment status
    payment.status = intent.status === 'succeeded' ? 'succeeded' : intent.status;
    payment.raw = intent;
    await payment.save();

    if (intent.status === 'succeeded') {
      // Update booking payment status
      const booking = await Booking.findById(bookingId);
      booking.paymentStatus = 'paid';
      booking.paymentIntentId = paymentIntentId;
      booking.status = 'confirmed';
      await booking.save();

      // enqueue notification to user
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

    res.json({ success: true, paymentStatus: payment.status });
  } catch (err) {
    console.error('confirm payment err', err);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
};
