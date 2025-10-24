const express = require('express');
const router = express.Router();
const flightController = require('../controllers/flightsController');

router.get('/search', flightController.searchFlights);           
router.get('/number/:flightNumber', flightController.getFlightByNumber); 
router.get('/:id', flightController.getFlight);                 
router.get('/', flightController.listFlights);                  
router.post('/', flightController.createFlight);                 

module.exports = router;
