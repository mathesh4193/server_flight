const nodemailer = require('nodemailer');
const User = require('../models/User');
const Notification = require('../models/Notification');

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

exports.enqueueNotification = async ({ userId, bookingId, type, channels = ['email'], subject, body, to }) => {
  try {
    let recipient = to;
    if (!recipient && userId) {
      const user = await User.findById(userId);
      recipient = user?.email;
    }

    const created = [];
    for (const channel of channels) {
      const notification = await Notification.create({
        user: userId,
        booking: bookingId,
        type,
        channel,
        to: recipient,
        subject,
        body,
      });

      if (channel === 'email' && recipient) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: recipient,
            subject: subject || 'Notification',
            html: `<p>${body}</p>`,
          });
          notification.sent = true;
        } catch (err) {
          notification.error = err.message;
        }
        await notification.save();
      }

      // TODO: implement SMS and push channels if needed
      created.push(notification);
    }

    return created;
  } catch (err) {
    console.error('Notification enqueue error:', err);
    throw err;
  }
};
