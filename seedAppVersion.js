/**
 * One-off script to set the app version numbers.
 *
 * Put this file in your backend ROOT (next to package.json / index.js), then:
 *
 *   node seedAppVersion.js            # android (default)
 *   node seedAppVersion.js ios        # ios
 *   node seedAppVersion.js all        # both
 *
 * Re-run it any time you publish a new build — just change the numbers below.
 * Safe to run repeatedly: it upserts, so it updates the row if it exists and
 * creates it if it doesn't.
 */

require("dotenv").config();
const mongoose = require("mongoose");

/* ======================= EDIT THESE, THEN RUN ========================= */

// The database your app actually uses. REQUIRED — your MONGODB_URL has no
// database name in it (it ends in `/?ssl=true...`), so without this the driver
// falls back to `authSource` and tries to write into `admin`, where your user
// has no permission. That is the "not authorized on admin" error.
const DB_NAME = "test";

const PLATFORM_CONFIG = {
  android: {
    // The build currently LIVE on the Play Store.
    // Must match `versionCode` in android/app/build.gradle for that release.
    latestVersionCode: 14,
    latestVersionName: "1.0.14",

    // Builds BELOW this number are hard-blocked and cannot use the app at all.
    // Leave at 0 unless you specifically need to force everyone off an old build.
    minSupportedVersionCode: 14,

    storeUrl: "https://play.google.com/store/apps/details?id=com.privily.app",

    // Optional. Shown as the headline on the update screen. Leave null for the
    // app's default wording.
    message: null,
  },

  ios: {
  latestVersionCode: 20829,      // = Build (CURRENT_PROJECT_VERSION) in Xcode
  latestVersionName: "2.8.29",   // = Version (MARKETING_VERSION) in Xcode
  minSupportedVersionCode: 0,
  storeUrl: "https://apps.apple.com/app/id6740980139",
  message: null,
},

};

/* ===================== nothing to change below ======================== */

// Your .env may name this differently — the script tries the common ones and
// tells you which names it looked for if none are set.
const CANDIDATE_KEYS = [
  "MONGODB_URL",
  "MONGO_URL",
  "MONGODB_URI",
  "MONGO_URI",
  "DB_URL",
  "DATABASE_URL",
];

const resolveMongoUrl = () => {
  for (const key of CANDIDATE_KEYS) {
    if (process.env[key]) return { key, url: process.env[key] };
  }
  return null;
};

const resolveTargets = () => {
  const arg = String(process.argv[2] || "android").toLowerCase();
  if (arg === "all") return ["android", "ios"];
  if (PLATFORM_CONFIG[arg]) return [arg];
  return null;
};

const appVersionSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, unique: true, index: true },
    latestVersionCode: { type: Number, required: true },
    latestVersionName: String,
    minSupportedVersionCode: { type: Number, default: 0 },
    storeUrl: String,
    message: String,
  },
  { timestamps: true }
);

const AppVersion =
  mongoose.models.AppVersion || mongoose.model("AppVersion", appVersionSchema);

(async () => {
  const found = resolveMongoUrl();

  if (!found) {
    console.error(
      "\n❌ Could not find a Mongo connection string in .env\n" +
        `   Looked for: ${CANDIDATE_KEYS.join(", ")}\n` +
        "   Open your .env, find the line with your Mongo URL, and either\n" +
        "   rename it to MONGODB_URL or add its name to CANDIDATE_KEYS above.\n"
    );
    process.exit(1);
  }

  const targets = resolveTargets();

  if (!targets) {
    console.error(
      `\n❌ Unknown platform "${process.argv[2]}".\n` +
        "   Usage: node seedAppVersion.js [android|ios|all]\n"
    );
    process.exit(1);
  }

  if (!DB_NAME) {
    console.error(
      "\n❌ DB_NAME is empty. Set it at the top of this file to the database\n" +
        "   your app uses, or the write lands in `admin` and is rejected.\n"
    );
    process.exit(1);
  }

  for (const platform of targets) {
    const config = PLATFORM_CONFIG[platform];
    if (config.minSupportedVersionCode > config.latestVersionCode) {
      console.error(
        `\n❌ Refusing to run: ${platform} minSupportedVersionCode is higher\n` +
          "   than latestVersionCode. That would hard-block every user on a\n" +
          "   build that isn't in the store yet, with no way to recover.\n"
      );
      process.exit(1);
    }
  }

  console.log(`Using connection string from ${found.key}`);
  console.log(`Seeding: ${targets.join(", ")}`);

  try {
    // Mongoose 5 needs these flags; Mongoose 6+ removed them and errors if
    // they are passed, so only send them on 5.x.
    const isMongoose5 = parseInt(mongoose.version, 10) < 6;
    const legacyOptions = isMongoose5
      ? {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useFindAndModify: false,
          useCreateIndex: true,
        }
      : {};

    await mongoose.connect(found.url, { dbName: DB_NAME, ...legacyOptions });
    console.log(`✅ Connected to MongoDB (database: ${DB_NAME})`);

    for (const platform of targets) {
      const doc = await AppVersion.findOneAndUpdate(
        { platform },
        { platform, ...PLATFORM_CONFIG[platform] },
        { new: true, upsert: true }
      );

      console.log(`\n✅ Saved [${doc.platform}]:\n`);
      console.log(`   latestVersionCode        ${doc.latestVersionCode}`);
      console.log(`   latestVersionName        ${doc.latestVersionName}`);
      console.log(`   minSupportedVersionCode  ${doc.minSupportedVersionCode}`);
      console.log(`   storeUrl                 ${doc.storeUrl}`);

      if (doc.minSupportedVersionCode > 0) {
        console.log(
          `\n⚠️  ${doc.platform} users on versionCode < ` +
            `${doc.minSupportedVersionCode} are now HARD BLOCKED and cannot ` +
            "use the app until they update."
        );
      }
    }

    console.log("\nVerify with:");
    for (const platform of targets) {
      console.log(
        `   curl "https://privily.co/test/api/app/version?platform=${platform}"`
      );
    }
    console.log("");
  } catch (err) {
    console.error("\n❌ Failed:", err.message, "\n");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
