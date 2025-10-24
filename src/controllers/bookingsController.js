const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const User = require('../models/User');
const PDFDocument = require('pdfkit');

//  Create a new booking
exports.createBooking = async (req, res) => {
  try {
    const { flightId: flightIdFromBody, flightNumber, passengers, cabinClass, contactInfo } = req.body;
    const userId = req.user?._id; // optional for guest users

    if (!passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ message: 'Passengers information is required' });
    }

    let flight;

    // 🔹 Check flight by number
    if (flightNumber) {
      flight = await Flight.findOne({ flightNumber });

      if (!flight) {
        // Create a new flight if full details are provided
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
            cabinClass: 'economy',
          });
        } else {
          return res.status(404).json({ message: 'Flight not found and insufficient data to create one' });
        }
      }
    }
    // 🔹 Check flight by ID
    else if (flightIdFromBody) {
      if (!mongoose.Types.ObjectId.isValid(flightIdFromBody)) {
        return res.status(400).json({ message: 'Invalid flight ID' });
      }
      flight = await Flight.findById(flightIdFromBody);
      if (!flight) return res.status(404).json({ message: 'Flight not found' });
    } else {
      return res.status(400).json({ message: 'Either flightId or flightNumber must be provided' });
    }

    // 💰 Calculate total price
    const priceMultiplier = cabinClass === 'business' ? 1.5 : cabinClass === 'first' ? 2 : 1;
    const totalPrice = flight.price * passengers.length * priceMultiplier;

    // 📞 Auto-fill contact info
    let finalContactInfo = { ...contactInfo };
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        finalContactInfo.email = finalContactInfo.email || user.email;
        finalContactInfo.phone = finalContactInfo.phone || user.phone;
      }
    }

    // 🧾 Prepare booking data
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

//  Get all bookings of logged-in user
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate('flight');
    res.json({ success: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

//  Get a single booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }
    const booking = await Booking.findById(id).populate('flight');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

//  Check bookings by flight number + contact info
exports.checkBookingByFlightDetails = async (req, res) => {
  try {
    const { flightNumber, email, phone } = req.body;
    const flight = await Flight.findOne({ flightNumber });
    if (!flight) return res.status(404).json({ message: 'Flight not found with this flight number' });

    const bookings = await Booking.find({
      flight: flight._id,
      $or: [
        { 'contactInfo.email': email },
        { 'contactInfo.phone': phone }
      ],
    }).populate('flight');

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this flight with provided contact info' });
    }

    res.json({ success: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

//  Generate and download ticket as PDF
exports.generateTicket = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('flight');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const doc = new PDFDocument();
    const filename = `ticket-${booking._id}.pdf`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);

    // 🛫 Ticket Header
    doc.fontSize(22).text('✈️ Airline Ticket', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Booking ID: ${booking._id}`);
    doc.text(`Status: ${booking.status ? booking.status.toUpperCase() : 'CONFIRMED'}`);
    doc.moveDown();

    // 🛩 Flight Details
    doc.fontSize(16).text('Flight Details', { underline: true });
    doc.fontSize(12)
      .text(`Airline: ${booking.flight.airline}`)
      .text(`Flight No: ${booking.flight.flightNumber}`)
      .text(`From: ${booking.flight.origin}`)
      .text(`To: ${booking.flight.destination}`)
      .text(`Departure: ${new Date(booking.flight.departureDate).toLocaleString()}`)
      .text(`Cabin Class: ${booking.cabinClass}`)
      .moveDown();

    // 👥 Passenger List
    doc.fontSize(16).text('Passengers', { underline: true });
    booking.passengers.forEach((p, i) => {
      doc.fontSize(12).text(`${i + 1}. ${p.firstName} ${p.lastName} (${p.gender}) - DOB: ${p.dateOfBirth}`);
    });
    doc.moveDown();

    // 💳 Payment Summary
    doc.fontSize(14).text(`Total Amount: ₹${booking.totalPrice}`, { align: 'right' });
    doc.moveDown(2);

    // ✉️ Contact Info
    doc.fontSize(12)
      .text(`Contact Email: ${booking.contactInfo?.email || 'N/A'}`)
      .text(`Contact Phone: ${booking.contactInfo?.phone || 'N/A'}`);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating ticket', error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only allow cancellation if booking is not already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.checkInBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only allow check-in if booking is confirmed and not already checked in
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Booking must be confirmed to check in' });
    }

    if (booking.checkedIn) {
      return res.status(400).json({ message: 'Already checked in' });
    }

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();

    res.json({ success: true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
