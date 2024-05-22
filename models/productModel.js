const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var productSchema = new mongoose.Schema(
  {
    productId: {
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

    location: {
      type: Number,
      required: true,
    },

    category: {
      type: Number, // [Desk, MeetingRoom, PrivateOffice, Event and Lifestyle]
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
      // { feature: "Ventilated", value: "value1" },
      // { feature: "Sound Proof", value: "value2" },
      // { feature: "Comfortable Seating", value: "value3" },
      // { feature: "Wifi from hosting facility", value: "value4" },
      // { feature: "Electric Connection", value: "value5" },

      {
        feature: String,
        value: String,
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
