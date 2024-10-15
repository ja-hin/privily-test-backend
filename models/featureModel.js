const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var featureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number, // Add this field to store the order of features
    required: true,
  },
});

//Export the model
module.exports = mongoose.model("Features", featureSchema);
