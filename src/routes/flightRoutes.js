const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightsController');

router.get('/search', flightController.searchFlights); // ✅ search route
router.get('/:id', flightController.getFlight);         // ✅ get flight by ID
router.get('/', flightController.listFlights);          // ✅ list all flights
router.post('/', flightController.createFlight);        // ✅ create flight

module.exports = router;
