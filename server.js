require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const flightRoutes = require('./src/routes/flightRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');

const app = express();

// ✅ Middleware
app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000', // frontend origin
    credentials: true,
  })
);

// ✅ Root route — shows API running message
app.get('/', (req, res) => {
  res.send(' API is running successfully on Flight Booking Server!');
});

// ✅ Other routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);
// ✅ Health check route
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error(' Server Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ✅ DB + Server startup
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flightbook';

connectDB(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect DB:', err);
  });
