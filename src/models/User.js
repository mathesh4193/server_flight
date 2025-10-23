// models/User.js (only changed parts shown)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'] },
  email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, index: true },
  password: { type: String, required: [true, 'Password is required'], minlength: 6 },
  phone: String,
  preferences: {
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    seatPreference: { type: String, enum: ['any', 'window', 'aisle', 'middle'], default: 'any' },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    // add other preference fields as needed
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
