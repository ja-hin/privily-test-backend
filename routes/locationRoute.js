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
  deleteFeature,
  editFeature,
  deleteLocation,
  editLocation,
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
router.delete("/delete-feature/:id", authMiddleware, isAdmin, deleteFeature);
router.delete("/delete-Location/:id", authMiddleware, isAdmin, deleteLocation);
router.put("/edit-feature/:id", authMiddleware, isAdmin, editFeature);
router.put("/edit-location/:id", authMiddleware, isAdmin, editLocation);




module.exports = router;
