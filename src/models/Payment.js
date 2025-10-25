const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentGateway: { 
    type: String, 
    enum: ['stripe', 'paypal', 'razorpay', 'bank_transfer'], 
    default: 'stripe' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'bank_transfer'], 
    required: true 
  },
  paymentIntentId: { type: String },
  transactionId: { type: String },
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['created', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'], 
    default: 'created' 
  },
  refundId: { type: String },
  refundAmount: { type: Number },
  refundReason: { type: String },
  refundedAt: { type: Date },
  metadata: { type: Object }, // Additional payment data
  raw: { type: Object }, // store raw response if needed
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
