const express = require('express');
const router = express.Router();
const { 
  createBooking, 
  getUserBookings, 
  getBookingById, 
  checkBookingByFlightDetails,
  cancelBooking,
  checkInBooking
} = require('../controllers/bookingsController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', createBooking); 
router.post('/authenticated', protect, createBooking); 
router.get('/', protect, getUserBookings);
router.get('/:id', protect, getBookingById);
router.post('/check', checkBookingByFlightDetails); 
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/checkin', protect, checkInBooking);

module.exports = router;
