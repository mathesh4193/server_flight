const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: String,
});

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
  bookingReference: { type: String, unique: true },
  passengers: [passengerSchema],
  cabinClass: { type: String, enum: ['economy','business','first'], default: 'economy' },
  totalPrice: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
  paymentIntentId: { type: String },
  contactInfo: {
    email: String,
    phone: String,
  },
  status: { type: String, enum: ['booked','confirmed','cancelled','checked_in'], default: 'booked' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Generate a unique booking reference before saving
bookingSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    // Generate a random 6-character alphanumeric booking reference
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference = '';
    for (let i = 0; i < 6; i++) {
      reference += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.bookingReference = reference;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
