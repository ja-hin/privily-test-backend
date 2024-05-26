// models/pageModel.js

const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ['terms-and-conditions', 'privacy-policy'] },
    content: { type: String, required: true }
});

const Page = mongoose.model('Page', pageSchema);
module.exports = Page;
