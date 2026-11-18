const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  podTitle:{
     type: String,
      required: true,
  },
    podId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    bookingPurpose: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      default: "", // Optional field
    },
    description: {
      type: String,
    },
    bookingDate: {
      type: Date,
      require: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    timeSlotNumber: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    Userid:{
      type: String,
      required: true,
    },
    serial:{
      type: String,
      required: true,
    },
    password:{
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Cancelled",
        "Processing",
        "Completed",
        "Rated",
      ],
      default: "Pending",
    },
    isBookingActive: {
      type: Boolean,
      default: true,
    },
    feedback: {
      rating: { type: Number },
      message: { type: String },
    },
    // Payment summary. Filled for paid bookings; absent on free/host bookings.
    paymentGateway: {
      type: String,
      enum: ["yoco", "paystack", null],
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
    },
    amountInCents: {
      type: Number,
      default: 0,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
