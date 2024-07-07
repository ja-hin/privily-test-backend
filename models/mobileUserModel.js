// models/mobileUserModel.js
const mongoose = require("mongoose");

const mobileUserSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    phoneNumber: { type: String, required: true, unique: true },
    otp: String,
    otpExpires: Date,
});

module.exports = mongoose.model("MobileUser", mobileUserSchema);
