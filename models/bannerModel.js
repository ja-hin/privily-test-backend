// models/bannerModel.js

const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    link: { type: String, required: true }
});

const Banner = mongoose.model('Banner', bannerSchema);
module.exports = Banner;


