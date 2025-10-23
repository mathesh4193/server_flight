const express = require('express');
const router = express.Router();
const { createBooking, getUserBookings } = require('../controllers/bookingsController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);

module.exports = router;
