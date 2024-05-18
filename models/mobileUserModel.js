// models/User.js
const mongoose = require('mongoose');

const mobileUserSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    otp: String,
    otpExpires: Date
});

module.exports = mongoose.model('MobileUser', mobileUserSchema);
