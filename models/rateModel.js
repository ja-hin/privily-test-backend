const mongoose = require("mongoose");

// Declare the Schema of the Mongo model
var rateSchema = new mongoose.Schema({
  
  rate: {
    type: String,
    required: true,
  },

});

// Export the model
module.exports = mongoose.model("rates", rateSchema);
