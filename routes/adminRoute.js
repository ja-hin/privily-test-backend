const express = require("express");
const {
  getAdminStats,
  getAllBookingsAdmin,
  getBookingDetail,
  getAllUsersAdmin,
  getAllTransactionsAdmin,
  getAllRatingsAdmin,
  getLocationsAdmin,
} = require("../controller/adminCtrl");
const { authMiddleware, isAdmin } = require("../middlew/authMIddleware");

const router = express.Router();

router.get("/stats", authMiddleware, isAdmin, getAdminStats);
router.get("/bookings", authMiddleware, isAdmin, getAllBookingsAdmin);
router.get("/booking/:id", authMiddleware, isAdmin, getBookingDetail);
router.get("/users", authMiddleware, isAdmin, getAllUsersAdmin);
router.get("/transactions", authMiddleware, isAdmin, getAllTransactionsAdmin);
router.get("/ratings", authMiddleware, isAdmin, getAllRatingsAdmin);
router.get("/locations", authMiddleware, isAdmin, getLocationsAdmin);

module.exports = router;
