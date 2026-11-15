const asyncHandler = require("express-async-handler");
const AppVersion = require("../models/appVersionModel");

const DEFAULT_STORE_URLS = {
  android: "https://play.google.com/store/apps/details?id=com.privily.app",
  ios: "https://apps.apple.com/app/id000000000", // TODO: real App Store id
};

/**
 * GET /api/app/version?platform=android
 * Called by the app on every cold start and on return to foreground.
 * Must stay public — it runs before the user is logged in.
 */
const getAppVersion = asyncHandler(async (req, res) => {
  const platform = String(req.query.platform || "android").toLowerCase();

  const doc = await AppVersion.findOne({ platform });

  // Nothing configured yet: answer "no update" rather than erroring, so the
  // app never blocks anyone just because a row is missing.
  if (!doc) {
    return res.json({
      latestVersionCode: null,
      minSupportedVersionCode: null,
      storeUrl: DEFAULT_STORE_URLS[platform] || DEFAULT_STORE_URLS.android,
    });
  }

  res.json({
    latestVersionCode: doc.latestVersionCode,
    latestVersionName: doc.latestVersionName,
    minSupportedVersionCode: doc.minSupportedVersionCode,
    storeUrl:
      doc.storeUrl || DEFAULT_STORE_URLS[platform] || DEFAULT_STORE_URLS.android,
    message: doc.message,
  });
});

/**
 * PUT /api/app/version
 * ADMIN ONLY. Whoever can call this can lock every user out of the app.
 */
const setAppVersion = asyncHandler(async (req, res) => {
  const {
    platform = "android",
    latestVersionCode,
    latestVersionName,
    minSupportedVersionCode,
    storeUrl,
    message,
  } = req.body;

  if (latestVersionCode === undefined) {
    return res.status(400).json({ message: "latestVersionCode is required" });
  }

  const latest = Number(latestVersionCode);
  const min = Number(minSupportedVersionCode ?? 0);

  if (Number.isNaN(latest) || Number.isNaN(min)) {
    return res.status(400).json({ message: "Version codes must be numbers" });
  }

  // Guard rail: this would hard-block everyone on a build that is not even in
  // the store yet, with no way for them to recover.
  if (min > latest) {
    return res.status(400).json({
      message: "minSupportedVersionCode cannot exceed latestVersionCode",
    });
  }

  const doc = await AppVersion.findOneAndUpdate(
    { platform: String(platform).toLowerCase() },
    {
      latestVersionCode: latest,
      latestVersionName,
      minSupportedVersionCode: min,
      storeUrl,
      message,
    },
    { new: true, upsert: true }
  );

  res.json(doc);
});

module.exports = { getAppVersion, setAppVersion };
