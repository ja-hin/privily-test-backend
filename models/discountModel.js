const mongoose = require("mongoose");

// Declare the Schema of the Mongo model
var discountSchema = new mongoose.Schema({
  discount: {
    type: String,
    required: true,
  },
});

// Export the model
module.exports = mongoose.model("discount", discountSchema);
