const mongoose = require("mongoose");

var Corporate = new mongoose.Schema(
    {
        companyName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
        },
    }
);

//Export the model
module.exports = mongoose.model("Corporate", Corporate);
