const mongoose = require("mongoose");

// Declare the Schema of the Mongo model
var RateSchema = new mongoose.Schema({
  
  rate: {
    type: String,
    required: true,
  },

});

// Export the model
module.exports = mongoose.model("Rates", RateSchema);
