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
  Street: {
    type: String,
    required: true,
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
  images: {
    public_id: String,
    url: String,
  },
});

//Export the model
module.exports = mongoose.model("Location", locationSchema);
