const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  type: { type: String }, // booking_confirm, flight_update, payment_success...
  channel: { type: String, enum: ['email','sms','push'] },
  to: String,
  subject: String,
  body: String,
  sent: { type: Boolean, default: false },
  error: String,
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
