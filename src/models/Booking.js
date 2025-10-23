const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
  passengers: [
    {
      firstName: String,
      lastName: String,
      dateOfBirth: Date,
      gender: String
    }
  ],
  cabinClass: { type: String, enum: ['economy','business','first'], default: 'economy' },
  totalPrice: { type: Number, required: true },
  paymentStatus: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
