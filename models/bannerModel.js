// models/bannerModel.js

const mongoose = require('mongoose');

const bannerItemSchema = new mongoose.Schema({
    image: { type: String, required: true },
    url: { type: String, required: true }
}, { _id: false });

const bannerSchema = new mongoose.Schema({
    top_carousel: [bannerItemSchema],
    corporate_pods: [bannerItemSchema]
    // Add more predefined categories as needed
}, { strict: false }); // Allow dynamic fields

const Banner = mongoose.model('Banner', bannerSchema);
module.exports = Banner;
