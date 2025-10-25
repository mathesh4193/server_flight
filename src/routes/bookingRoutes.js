const express = require('express');
const router = express.Router();
const {
  createBooking,
  getUserBookings,
  getBookingById,
  getBookingsByUserEmail,
  cancelBooking,
  checkInBooking,
  downloadTicket
} = require('../controllers/bookingsController');

const { protect } = require('../middleware/authMiddleware'); // JWT auth

// Booking routes
router.post('/', createBooking); // Guest or Auth
router.post('/authenticated', protect, createBooking); // Authenticated only

router.get('/', protect, getUserBookings);
router.get('/:id', protect, getBookingById);
router.get('/search/by-email', protect, getBookingsByUserEmail);

// Download ticket
router.get('/:id/ticket', protect, downloadTicket);

// Cancel & Check-in
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/checkin', protect, checkInBooking);

module.exports = router;
