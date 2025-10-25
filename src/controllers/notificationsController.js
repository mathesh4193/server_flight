// backend/controllers/notificationsController.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

exports.sendBookingConfirmation = async (req, res) => {
  try {
    const { userId, booking } = req.body;

    // Save notification in DB
    const notification = await Notification.create({
      user: userId,
      type: 'booking',
      message: `Your booking ${booking._id} for flight ${booking.flightNumber} is confirmed.`,
    });

    // Send email/SMS
    await notificationService.sendBookingNotification(userId, notification);

    res.status(200).json({ success: true, notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
};

exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};
