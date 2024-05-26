const express = require("express");
const {
  getAllLocations,
  getAllLocationsDetails,
  createLocations,
} = require("../controller/locationCtrl");
const { isAdmin, authMiddleware } = require("../middlew/authMIddleware");
const router = express.Router();

router.get("/", getAllLocations);
router.get("/details/", getAllLocationsDetails);
router.post("/create/", createLocations);


module.exports = router;
