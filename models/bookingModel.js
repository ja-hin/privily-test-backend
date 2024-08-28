const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
