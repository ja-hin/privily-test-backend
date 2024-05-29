const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    slot_bookings: {
        type: [Boolean], // Array of Booleans
        required: true,
    },
    // available_slots: {
    // type: [Number], // Array of Numbers (integers)
    // required: true,
    // validate: {
    //     validator: function (arr) {
    //     return arr.every(Number.isInteger); // Ensure all elements are integers
    //     },
    //     message: 'All elements in the integers array must be integers'
    // }
    // }
  },
  {
    timestamps: true,
  }
);
// bookingSchema.index({ date: 1 }, { unique: true }); // Ensure unique bookings per date (optional)
module.exports = mongoose.model("ProductAvailability", bookingSchema, 'product_availability');
