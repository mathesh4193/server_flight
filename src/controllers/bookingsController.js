const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const mongoose = require('mongoose');

// ✅ Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { flightId, passengers, cabinClass } = req.body;
    const userId = req.user._id; // User ID from auth middleware

    // Validate flight ID
    if (!mongoose.Types.ObjectId.isValid(flightId)) {
      return res.status(400).json({ message: 'Invalid flight ID' });
    }

    // Check if flight exists
    const flight = await Flight.findById(flightId);
    if (!flight) return res.status(404).json({ message: 'Flight not found' });

    // Calculate total price with cabin class multiplier
    const priceMultiplier = cabinClass === 'business' ? 1.5 : cabinClass === 'first' ? 2 : 1;
    const totalPrice = flight.price * passengers.length * priceMultiplier;

    // Create booking
    const booking = await Booking.create({
      user: userId,
      flight: flight._id,
      passengers,
      cabinClass,
      totalPrice
    });

    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get all bookings of the logged-in user
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate('flight');
    res.json({ success: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get single booking by ID
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate booking ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id).populate('flight');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
