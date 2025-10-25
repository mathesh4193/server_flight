const Flight = require('../models/Flight');
const mongoose = require('mongoose');

// Get all flights
exports.listFlights = async (req, res) => {
  try {
    const flights = await Flight.find();
    res.json({ success: true, flights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get flight by ID
exports.getFlight = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid flight ID' });

    const flight = await Flight.findById(id);
    if (!flight) return res.status(404).json({ success: false, message: 'Flight not found' });

    res.json({ success: true, flight });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create flight
exports.createFlight = async (req, res) => {
  try {
    const flight = await Flight.create(req.body);
    res.status(201).json({ success: true, flight });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.searchFlights = async (req, res) => {
  const { origin, destination, departureDate } = req.query;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ success: false, message: 'Missing required query parameters' });
  }

  try {
    const startDate = new Date(departureDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(departureDate);
    endDate.setHours(23, 59, 59, 999);

    const flights = await Flight.find({
      origin: { $regex: new RegExp(`^${origin.trim()}$`, "i") },
      destination: { $regex: new RegExp(`^${destination.trim()}$`, "i") },
      departureDate: { $gte: startDate, $lte: endDate },
    });

    res.json({ success: true, flights });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
