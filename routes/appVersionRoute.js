const express = require("express");
const router = express.Router();
const {
  getAppVersion,
  setAppVersion,
} = require("../controller/appVersionCtrl");

// ⚠️ Check these names against your existing route files (e.g. authRoute.js)
// and fix the import if yours differ. Folder is `middlew`, not `middleware`.

const { authMiddleware, isAdmin } = require("../middlew/authMIddleware");
// Public — the app calls this before anyone is logged in.
router.get("/version", getAppVersion);

// Admin only.
router.put("/version", authMiddleware, isAdmin, setAppVersion);

module.exports = router;
