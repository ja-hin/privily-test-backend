const mongoose = require("mongoose");

// One document per platform. These two numbers are what the mobile app
// compares its own build number against on every cold start.
const appVersionSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      unique: true,
      index: true,
      enum: ["android", "ios"],
    },
    // Newest build in the store. Installs below this get a SOFT nudge.
    latestVersionCode: { type: Number, required: true },
    latestVersionName: { type: String },
    // The floor. Installs below this are HARD blocked and cannot continue.
    minSupportedVersionCode: { type: Number, default: 0 },
    storeUrl: { type: String },
    message: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppVersion", appVersionSchema);
