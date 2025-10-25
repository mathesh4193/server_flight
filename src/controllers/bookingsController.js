const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const User = require('../models/User');
const PDFDocument = require('pdfkit');

// Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { flightId, flightNumber, passengers, cabinClass, contactInfo } = req.body;
    const userId = req.user?._id;

    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ message: 'Passengers information is required' });
    }

    let flight;

    // Find flight by number
    if (flightNumber) {
      flight = await Flight.findOne({ flightNumber });
      if (!flight) {
        const { origin, destination, departureDate, arrivalDate, price, airline } = req.body;
        if (origin && destination && departureDate && price) {
          flight = await Flight.create({
            airline: airline || 'SpiceJet',
            flightNumber,
            origin,
            destination,
            departureDate: new Date(departureDate),
            arrivalDate: arrivalDate
              ? new Date(arrivalDate)
              : new Date(new Date(departureDate).getTime() + 60 * 60 * 1000),
            price,
            seatsAvailable: 100,
            cabinClass: cabinClass || 'economy',
          });
        } else {
          return res.status(404).json({ message: 'Flight not found and insufficient data to create one' });
        }
      }
    }
    // Find flight by ID
    else if (flightId) {
      if (!mongoose.Types.ObjectId.isValid(flightId)) return res.status(400).json({ message: 'Invalid flight ID' });
      flight = await Flight.findById(flightId);
      if (!flight) return res.status(404).json({ message: 'Flight not found' });
    } else {
      return res.status(400).json({ message: 'Either flightId or flightNumber must be provided' });
    }

    // Calculate total price
    const multiplier = cabinClass === 'business' ? 1.5 : cabinClass === 'first' ? 2 : 1;
    const totalPrice = flight.price * passengers.length * multiplier;

    // Fill contact info from user
    const finalContactInfo = { ...contactInfo };
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        finalContactInfo.email = finalContactInfo.email || user.email;
        finalContactInfo.phone = finalContactInfo.phone || user.phone;
      }
    }

    // Create booking
    const bookingData = {
      flight: flight._id,
      passengers,
      cabinClass: cabinClass || 'economy',
      totalPrice,
      contactInfo: finalContactInfo,
    };
    if (userId) bookingData.user = userId;

    const booking = await Booking.create(bookingData);
    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get bookings for logged-in user
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate('flight');
    res.json({ success: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

    const booking = await Booking.findById(id).populate('flight user');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get bookings by user email
exports.getBookingsByUserEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'User email is required' });

    const bookings = await Booking.find({ 'contactInfo.email': email }).populate('flight user');
    res.json({ success: true, bookings });
  } catch (err) {
    console.error('getBookingsByUserEmail error:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

// Download ticket PDF
exports.downloadTicket = async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(bookingId).populate('flight user');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=booking_${booking._id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text('Flight Ticket', { align: 'center' }).moveDown();
    doc.fontSize(14).text(`Booking ID: ${booking._id}`);
    doc.text(`Passenger(s):`);
    booking.passengers.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.firstName} ${p.lastName} — ${p.gender} — DOB: ${p.dateOfBirth}`);
    });
    doc.moveDown();
    doc.text(`Flight: ${booking.flight.airline} (${booking.flight.flightNumber})`);
    doc.text(`From: ${booking.flight.origin}`);
    doc.text(`To: ${booking.flight.destination}`);
    doc.text(`Departure: ${new Date(booking.flight.departureDate).toLocaleString()}`);
    doc.moveDown();
    doc.text(`Cabin Class: ${booking.cabinClass}`);
    doc.text(`Total Price: ₹${booking.totalPrice}`);
    doc.text(`Payment Status: ${booking.paymentStatus || 'UNPAID'}`);
    doc.end();
  } catch (err) {
    console.error('Download ticket error:', err);
    res.status(500).json({ message: 'Failed to generate ticket', error: err.message });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error('cancelBooking err:', err);
    res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
  }
};

// Check-in booking
exports.checkInBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'checked_in';
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error('checkInBooking err:', err);
    res.status(500).json({ message: 'Failed to check in booking', error: err.message });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking is already cancelled' });

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Check-in booking
exports.checkInBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid booking ID' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'confirmed') return res.status(400).json({ message: 'Booking must be confirmed to check in' });
    if (booking.checkedIn) return res.status(400).json({ message: 'Already checked in' });

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
exports.downloadTicket = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId).populate('flight user');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=booking_${booking._id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text('Flight Ticket', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text(`Booking ID: ${booking._id}`);
    doc.text(`Passenger(s):`);
    booking.passengers.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.firstName} ${p.lastName} — ${p.gender} — DOB: ${p.dateOfBirth}`);
    });
    doc.moveDown();

    doc.text(`Flight: ${booking.flight.airline} (${booking.flight.flightNumber})`);
    doc.text(`From: ${booking.flight.origin}`);
    doc.text(`To: ${booking.flight.destination}`);
    doc.text(`Departure: ${new Date(booking.flight.departureDate).toLocaleString()}`);
    doc.moveDown();

    doc.text(`Cabin Class: ${booking.cabinClass}`);
    doc.text(`Total Price: ₹${booking.totalPrice}`);
    doc.text(`Payment Status: ${booking.paymentStatus}`);

    doc.end();
  } catch (err) {
    console.error('Download ticket error:', err);
    res.status(500).json({ message: 'Failed to generate ticket' });
  }
};
