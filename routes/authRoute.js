//routes/authRoute.js

const express = require("express");
const {
  createUser,
  loginUserCtrl,
  getallUser,
  getaUser,
  deleteaUser,
  updatedUser,
  blockUser,
  unblockUser,
  handleRefreshToken,
  logout,
  updatePassword,
  forgotPasswordToken,
  resetPassword,
  loginAdmin,
  saveAddress,
  // applyCoupon,
  createBooking,
  getBookings,
  getBookingsByUser,
  getBookingById,
  cancelBooking,
  updateBookingById,
  updateBookingStatusAutomatically,
  updateBookingStatusByAdmin,
  setCurrentLocation,
  sendNotification,
  getAllNotification,
  rateBooking,
  loginMobileUserCtrl,
  verifyMobileOtp,
  bookingFeedback,
  corporatePods,
  getMe,
  extendBooking,
  registerAndAssignRoles,
  verifyAuthPage,
} = require("../controller/userCtrl");

const { authMiddleware, isAdmin } = require("../middlew/authMIddleware");

const router = express.Router();

router.post("/register", createUser);
router.post("/login", loginUserCtrl);
router.get('/me', authMiddleware, getMe);
router.post("/app-login", loginMobileUserCtrl);
router.post("/verify-otp", verifyMobileOtp);
router.post("/verify-page", verifyAuthPage);

router.post("/register-staff", registerAndAssignRoles);
router.get("/logout", logout);
router.post("/admin-login", loginAdmin);

router.post("/forgot-password-token", forgotPasswordToken);
router.put("/reset-password/:token", resetPassword);
router.put("/password", authMiddleware, updatePassword);
router.get("/refresh", handleRefreshToken);

router.get("/all-users", authMiddleware, isAdmin, getallUser);
router.delete("/:id", authMiddleware, isAdmin, deleteaUser);
router.put("/edit-user", authMiddleware, updatedUser);
router.put("/save-address", authMiddleware, saveAddress);
router.put("/current-location", authMiddleware, setCurrentLocation);

router.put("/block-user/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock-user/:id", authMiddleware, isAdmin, unblockUser);
// router.post("/apply-coupon", authMiddleware, applyCoupon);

router.post("/create-booking/:podId", authMiddleware, createBooking);
router.get("/all-bookingsByUser", authMiddleware, getBookingsByUser);
router.get("/all-bookings", authMiddleware, isAdmin, getBookings);

router.get("/booking/:id", authMiddleware, getBookingById);
router.put("/update-booking/:id", authMiddleware, updateBookingById);
router.put("/cancel-booking/:id", authMiddleware, cancelBooking);
router.put("/feedback/:id", authMiddleware, bookingFeedback);
router.get("/:id", authMiddleware, isAdmin, getaUser);
router.post("/corporate-pods", corporatePods);
router.post('/extend/:bookingId', authMiddleware, extendBooking);


router.put(
  "/auto-update-booking-status",
  authMiddleware,
  updateBookingStatusAutomatically
);

router.put(
  "/booking-status/:id",
  authMiddleware,
  isAdmin,
  updateBookingStatusByAdmin
);

router.post("/rate-booking/:id", authMiddleware, rateBooking);

router.get("/notifications/active", authMiddleware, getAllNotification);
router.put("/notification/send", authMiddleware, sendNotification);

module.exports = router;
