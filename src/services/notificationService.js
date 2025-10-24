const nodemailer = require('nodemailer');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendBookingNotification = async (userId, notification) => {
  try {
    const user = await User.findById(userId);

    // Send email
    if (user.email) {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: 'Booking Confirmation',
        html: `<p>${notification.message}</p>`,
      });
    }

    // Optionally send SMS if phone number exists
    // Implement your SMS provider here
  } catch (err) {
    console.error('Notification error:', err);
  }
};
