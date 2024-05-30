const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var productSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    description: {
      type: String,
      required: true,
    },
    booking_requirements: {
      type: String,
      required: true,
    },
    cancellation_policy: {
      type: String,
      required: true,
    },
    availability: {
      type: String,
      required: true,
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PCategory",
      required: true,
    },

    timeSlot: {
      type: String,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      required: true,
      default: true,
    },

    features: [
      {
        name: String,
        icon: String,
      },
    ],

    images: [
      {
        public_id: String,
        url: String,
      },
    ],

    tags: String,

    ratings: [
      {
        star: Number,
        comment: String,
        postedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    ratingCount: {
      type: Number,
      default: 0,
    },
    totalRating: {
      type: String,
      default: 0,
    },
  },
  { timestamps: true }
);

//Export the model
module.exports = mongoose.model("Product", productSchema);
