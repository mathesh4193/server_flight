const axios = require('axios');
const Flight = require('../models/Flight');
const Booking = require('../models/Booking');
const { enqueueNotification } = require('./notificationService');
const io = require('../utils/socket').getIO(); // helper to get socket instance

// Example: poll an airline endpoint periodically for updates (pseudo)
async function pollAirline(airlineApiUrl, apiKey) {
  try {
    const resp = await axios.get(`${airlineApiUrl}/flights/updates`, { headers: { 'x-api-key': apiKey } });
    const updates = resp.data.updates || [];
    for (const u of updates) {
      await processFlightUpdate(u);
    }
  } catch (err) {
    console.error('pollAirline error', err);
  }
}

async function processFlightUpdate(update) {
  // update object: { flightNumber, status, estimatedDeparture, estimatedArrival, route... }
  const flight = await Flight.findOne({ flightNumber: update.flightNumber });
  if (!flight) return;

  // update flight doc
  flight.departureDate = update.estimatedDeparture || flight.departureDate;
  flight.arrivalDate = update.estimatedArrival || flight.arrivalDate;
  flight.status = update.status || flight.status;
  await flight.save();

  // notify bookings on this flight
  const bookings = await Booking.find({ flight: flight._id, status: { $ne: 'cancelled' } }).populate('user');
  for (const b of bookings) {
    // create notification and send via queue
    await enqueueNotification({
      userId: b.user?._id,
      bookingId: b._id,
      type: 'flight_update',
      channels: ['email', 'sms'],
      subject: `Flight update: ${flight.flightNumber}`,
      body: `Your flight ${flight.flightNumber} status changed to ${flight.status}.`,
      to: b.contactInfo?.email || b.user?.email || b.contactInfo?.phone,
    });

    // real-time push via Socket.IO to the user's room (room name = userId)
    if (b.user?._id) io.to(b.user._id.toString()).emit('flightUpdate', {
      bookingId: b._id,
      flightId: flight._id,
      status: flight.status,
      departure: flight.departureDate,
      arrival: flight.arrivalDate,
    });
  }
}

module.exports = { pollAirline, processFlightUpdate };
