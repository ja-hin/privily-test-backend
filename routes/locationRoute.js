const express = require("express");
const {
  getAllLocations,
  getAllLocationsDetails,
  createLocations,
  blockLocation,
  unblockLocation,
  createFeature,
  getAllFeaturesDetails,
  blockFeature,
  unblockFeature,
} = require("../controller/locationCtrl");
const { isAdmin, authMiddleware } = require("../middlew/authMIddleware");
const router = express.Router();

router.get("/", getAllLocations);
router.get("/details", getAllLocationsDetails);
router.post("/create",  createLocations);
router.get("/features", getAllFeaturesDetails);
router.post("/create-features", authMiddleware, isAdmin, createFeature);
router.put("/block-features/:id", authMiddleware, isAdmin, blockFeature);
router.put("/block-Location/:id", authMiddleware, isAdmin, blockLocation);
router.put("/unblock-Location/:id", authMiddleware, isAdmin, unblockLocation);
router.put("/unblock-features/:id", authMiddleware, isAdmin, unblockFeature);




module.exports = router;
