const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  airline: { type: String, required: true },
  flightNumber: { type: String, required: true, unique: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  departureDate: { type: Date, required: true },
  arrivalDate: { type: Date, required: true },
  durationMinutes: { type: Number },
  price: { type: Number, required: true },
  seatsAvailable: { type: Number, default: 100 },
  cabinClass: { type: String, enum: ['economy','business','first'], default: 'economy' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Flight', flightSchema);
