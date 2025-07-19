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
  getallstaff,
  blockStaff,
  unblockStaff,
  deleteStaff,
  editStaff,
  updatebookingstatus,
  getUserByID,
  verifyEmail,
  getAllRatings,
} = require("../controller/userCtrl");

const { authMiddleware, isAdmin } = require("../middlew/authMIddleware");
const { createPayment } = require("../controller/PaymentCtrl");

const router = express.Router();

router.post("/register", createUser);
router.get("/get-user/:id", authMiddleware, isAdmin, getUserByID);
router.post("/login", loginUserCtrl);
router.get('/me', authMiddleware, getMe);
router.post("/app-login", loginMobileUserCtrl);
router.post("/verify-otp", verifyMobileOtp);
router.post("/verify-page", verifyAuthPage);
router.post("/verify-email", verifyEmail);

router.post("/register-staff", registerAndAssignRoles);
router.get("/logout", logout);
router.post("/admin-login", loginAdmin);
router.post("/create-payment", createPayment);
router.post("/forgot-password-token", forgotPasswordToken);
router.put("/reset-password/:token", resetPassword);
router.put("/password", authMiddleware, updatePassword);
router.get("/refresh", handleRefreshToken);

router.get("/all-users", authMiddleware, isAdmin, getallUser);
router.get("/all-staff", authMiddleware, isAdmin, getallstaff);
router.put("/block-staff/:id", authMiddleware, isAdmin, blockStaff);
router.put("/unblock-staff/:id", authMiddleware, isAdmin, unblockStaff);
router.put("/edit-staff/:id", authMiddleware, isAdmin, editStaff);

router.delete("/:id", authMiddleware, isAdmin, deleteaUser);
router.delete("/delete-staff/:id", authMiddleware, isAdmin, deleteStaff);
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
router.put("/update-booking/:id", updateBookingById);
router.put("/cancel-booking/:id", cancelBooking);
router.put("/feedback/:id",  bookingFeedback);
router.get("/:id", authMiddleware, isAdmin, getaUser);
router.post("/corporate-pods", corporatePods);
router.post('/extend/:bookingId', authMiddleware, extendBooking);
// router.post("/send-invoice/:bookingId", authMiddleware, sendInvoiceEmail);

router.put(
  "/auto-update-booking-status",
  authMiddleware,
  updateBookingStatusAutomatically
);
router.put(
  "/update-booking-status/:id",
  updatebookingstatus
);

router.put(
  "/booking-status/:id",
  authMiddleware,
  isAdmin,
  updateBookingStatusByAdmin
);

router.put("/rate/:bookingId/:productId", rateBooking);
router.get("/ratings/all", getAllRatings);
router.get("/notifications/active", authMiddleware, getAllNotification);
router.put("/notification/send", authMiddleware, sendNotification);

module.exports = router;
