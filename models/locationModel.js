const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country_code: {
    type: String,
    required: true,
  },
  zip: {
    type: String,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
    max: 90,
    min: -90,
  },
  longitude: {
    type: Number,
    required: true,
    max: 180,
    min: -180,
  },
});

//Export the model
module.exports = mongoose.model("Location", locationSchema);
