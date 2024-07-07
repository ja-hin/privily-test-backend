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
});

//Export the model
module.exports = mongoose.model("Features", featureSchema);
