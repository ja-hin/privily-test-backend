const User = require("../models/userModel");
const Booking = require("../models/bookingModel")
const Location = require("../models/locationModel");
const Transaction = require("../models/Transaction");
;
const asyncHandler = require("express-async-handler");
const { generateToken } = require("../config/jwtToken");
const validateMongoDbId = require("../utils/validateMongodbId");
const { generateRefreshToken } = require("../config/refreshtoken");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("./emailCtrl");
const twilio = require("twilio");
const MobileUserModel = require("../models/mobileUserModel");
const ProductAvailability = require("../models/productAvailability");
const { START_TIME, END_TIME } = require("./constants");
const Corporate = require("../models/corporateModel");
// const moment = require("moment-timezone");
const moment = require("moment");
const productModel = require("../models/productModel");
const registerstaff = require("../models/registerstaff");
const bcrypt = require("bcryptjs");
const { register } = require("module");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { Mongoose } = require("mongoose");
const logoPath = path.join(__dirname, "Logo.png");
const { generateInvoicePDF, zar } = require("./invoiceService");
const payments = require("../services/payments");
const { syncPaystackTransaction } = require("./PaymentCtrl");
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const createUser = asyncHandler(async (req, res) => { 
  const { email, phoneNumber, firstname, lastname } = req.body;
  if (!email || !phoneNumber || !firstname || !lastname) {
    return res.status(400).send("All fields are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send("User already exists");
  }

  try {
    const newUser = new User({
      email,
      phoneNumber,
      firstname,
      lastname,
      // password field is not included
    });
    await newUser.save();
    const token = generateToken(newUser._id);
    res.json({
      message: "User registered successfully",
      token,
      userId: newUser._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to register user");
  }
});
const deleteMyAccount = asyncHandler(async (req, res) => {
  // Identity comes from the verified token and NOWHERE else. Never take a user
  // id from req.body or req.params here - that would let any logged-in user
  // delete somebody else's account just by changing the id they send.
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Not authorised" });
  }

  // Bookings first, user second. If the booking delete fails we bail out with
  // the account still intact and the user can retry. The other order would
  // leave orphaned bookings pointing at a user that no longer exists.
  const bookings = await Booking.deleteMany({ user: userId });

  // ── Anonymise-instead alternative (see note above) ──
  // const now = new Date();
  // await Booking.deleteMany({ user: userId, startTime: { $gte: now } });
  // await Booking.updateMany(
  //   { user: userId },
  //   { $set: { user: null, customerName: "Deleted user", customerEmail: null,
  //             customerPhone: null, deletedAt: now } }
  // );

  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    return res.status(404).json({ message: "Account not found" });
  }

  res.json({
    message: "Account deleted",
    bookingsDeleted: bookings.deletedCount,
  });
});
const registerAndAssignRoles = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, phoneNumber, password, role, auth_page } =
    req.body;

  // Validate input
  if (
    !firstname ||
    !lastname ||
    !email ||
    !phoneNumber ||
    !password ||
    !role ||
    !auth_page
  ) {
    return res.status(400).send("All fields are required");
  }

  // Check if user already exists
  const existingUser = await registerstaff.findOne({ email });
  if (existingUser) {
    return res.status(400).send("User with this email already exists");
  }

  // Create new staff member
  const staffMember = new registerstaff({
    firstname,
    lastname,
    email,
    phoneNumber,
    password,
    role,
    auth_page,
  });

  // Save the new staff member
  await staffMember.save();

  res
    .status(201)
    .send("Staff member registered and roles assigned successfully");
});

const loginUserCtrl = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if staff exists
  const findStaff = await registerstaff.findOne({ email });
  if (findStaff && (await findStaff.isPasswordMatched(password))) {
    const refreshToken = generateRefreshToken(findStaff._id);
    await registerstaff.findByIdAndUpdate(findStaff._id, { refreshToken });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000, // 3 days
    });
    res.json({
      _id: findStaff._id,
      firstname: findStaff.firstname,
      lastname: findStaff.lastname,
      email: findStaff.email,
      phoneNumber: findStaff.phoneNumber,
      role: findStaff.role,
      auth_page: findStaff.auth_page,
      token: generateToken(findStaff._id),
    });
  } else {
    res.status(401).json({
      message: "Invalid email or password. Please try again.",
      status: 400,
    });
  }
});

const APP_HASH_RE = /^[A-Za-z0-9+/]{11}$/;

const resolveAppHash = (raw) => {
  const candidate = String(raw || "").trim();
  if (APP_HASH_RE.test(candidate)) return candidate;
  // Fallback for older app builds that don't send it yet.
  const fallback = String(process.env.ANDROID_APP_HASH || "").trim();
  return APP_HASH_RE.test(fallback) ? fallback : null;
};

const loginMobileUserCtrl = asyncHandler(async (req, res) => {
  const { phoneNumber, appSignatureHash } = req.body;
  if (!phoneNumber) {
    return res.status(400).send("Phone number is required");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // valid 10 minutes

  try {
    let mobileUser = await MobileUserModel.findOne({ phoneNumber });
    if (!mobileUser) {
      mobileUser = new MobileUserModel({ phoneNumber });
    }

    mobileUser.otp = otp;
    mobileUser.otpExpires = otpExpires;
    await mobileUser.save();

    const appHash = resolveAppHash(appSignatureHash);
    if (!appHash) {
      console.warn(
        `OTP for ${phoneNumber}: no valid app hash (client sent: ${appSignatureHash}). Autofill will not work.`
      );
    }

    // SMS Retriever requires: starts with "<#>", and the 11-char hash is the
    // LAST thing in the message. Whole body must stay under 140 bytes.
    const body = appHash
      ? `<#> Your Privily App OTP is ${otp}\n${appHash}`
      : `Your Privily App OTP is ${otp}`;

    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    res.send("OTP sent successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to send OTP");
  }
});

// admin login
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const findAdmin = await User.findOne({ email });
  if (findAdmin.role !== "admin") throw new Error("Not Authorised");
  if (findAdmin && (await findAdmin.isPasswordMatched(password))) {
    const refreshToken = await generateRefreshToken(findAdmin?._id);
    await User.findByIdAndUpdate(findAdmin._id, { refreshToken });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      _id: findAdmin?._id,
      firstname: findAdmin?.firstname,
      lastname: findAdmin?.lastname,
      email: findAdmin?.email,
      phoneNumber: findAdmin?.phoneNumber,
      token: generateToken(findAdmin?._id),
    });
  } else {
    throw new Error("Invalid Credentials");
  }
});

const verifyMobileOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res.status(400).send("Phone number and OTP are required");
  }

  try {
    const mobileUser = await MobileUserModel.findOne({ phoneNumber });
    if (!mobileUser) {
      return res.status(400).send("User not found");
    }

    if (mobileUser.otp !== otp || new Date() > mobileUser.otpExpires) {
      return res.status(400).send("Invalid or expired OTP");
    }

    mobileUser.otp = null;
    mobileUser.otpExpires = null;
    await mobileUser.save();

    const existingUser = await User.findOne({ phoneNumber: phoneNumber });
    console.log("existingUser");
    console.log(existingUser);
    if (existingUser) {
      if (existingUser.isBlocked) {
        return res.status(403).json({ message: "User is blocked" });
      }
      const token = generateToken(existingUser._id);
      res.json({
        message: "OTP verified successfully",
        status: 0,
        token,
        userId: existingUser._id,
      });
    } else {
      res.json({ message: "OTP verified successfully", status: 1 });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to verify OTP");
  }
});
const verifyEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.isBlocked) {
        return res.status(403).json({ message: "User is blocked" });
      }

      const token = generateToken(existingUser._id);

      return res.json({
        message: "Email exists",
        status: 0,
        token,
        userId: existingUser._id,
      });
    } else {
      return res.json({
        message: "Email not found",
        status: 1,
      });
    }
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ message: "Failed to verify email" });
  }
});

const verifyAuthPage = asyncHandler(async (req, res) => {
  const { id, auth_page } = req.body;

  if (!id || auth_page === undefined) {
    return res.status(400).send("Invalid request body");
  }

  try {
    // Find the user by ID
    const user = await registerstaff.findById(id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Check if the auth_page array contains the specified page number
    const success = user.auth_page.includes(auth_page);

    // Return true if the user has access, otherwise false
    res.status(200).json({ success });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// handle refresh token
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No Refresh Token in Cookies");
  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });
  if (!user) throw new Error(" No Refresh token present in db or not matched");
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || user.id.toString() !== decoded.id) {
      throw new Error("There is something wrong with refresh token");
    }
    const accessToken = generateToken(user?._id);
    res.json({ accessToken });
  });
});

// logout functionality
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No Refresh Token in Cookies");
  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });
  if (!user) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
    });
    return res.sendStatus(204);
  }
  await User.findOneAndUpdate(refreshToken, {
    refreshToken: "",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
  });
  res.json({ message: "Logged Out Successfully", status: 200 });
});

// Update a user
const updatedUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        firstname: req?.body?.firstname,
        lastname: req?.body?.lastname,
        email: req?.body?.email,
        phoneNumber: req?.body?.phoneNumber,
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

// save user Address
const saveAddress = asyncHandler(async (req, res, next) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        address: req?.body?.address,
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

// save user current location and visited location history in user model for future use in location based services and products recommendation etc.
const setCurrentLocation = asyncHandler(async (req, res, next) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const { lng, lat } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        userCurrentLocation: { lng: lng, lat: lat },
      },
      {
        new: true,
      }
    );
    const updatedVisitedLocations = [
      ...updatedUser.userVisitedLocation,
      { lng: lng, lat: lat },
    ];
    await User.findByIdAndUpdate(_id, {
      userVisitedLocation: updatedVisitedLocations,
    });

    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

// Get all users
const getallUser = asyncHandler(async (req, res) => {
  try {
    const getUsers = await User.find();
    res.json(getUsers);
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: "An error occurred while fetching users.",
    });
  }
});
const getallstaff = asyncHandler(async (req, res) => {
  try {
    const getstaff = await registerstaff.find();
    res.json(getstaff);
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: "An error occurred while fetching users.",
    });
  }
});
const blockStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;

  validateMongoDbId(id); // Make sure this function is correctly implemented

  try {
    const blockusr = await registerstaff.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    );

    if (!blockusr) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error); // Log the error
    res.status(500).json({ message: error.message });
  }
});
const unblockStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await registerstaff.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    );
    if (!unblock) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const editStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, phoneNumber, password, role, auth_page } =
    req.body;

  validateMongoDbId(id);

  try {
    const staffMember = await registerstaff.findById(id);
    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Update fields
    staffMember.firstname = firstname || staffMember.firstname;
    staffMember.lastname = lastname || staffMember.lastname;
    staffMember.email = email || staffMember.email;
    staffMember.phoneNumber = phoneNumber || staffMember.phoneNumber;
    staffMember.role = role || staffMember.role;
    staffMember.auth_page = auth_page || staffMember.auth_page;

    // If password is provided, it will be hashed by the pre-save hook
    if (password) {
      staffMember.password = password;
    }

    await staffMember.save();

    res.json({ message: "Staff member updated successfully", staffMember });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deleteaUser = await registerstaff.findByIdAndDelete(id);
    res.json({
      deleteaUser,
    });
  } catch (error) {
    throw new Error(error);
  }
});

// Get a single user
const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const getaUser = await User.findById(id);
    res.json({
      getaUser,
    });
  } catch (error) {
    throw new Error(error);
  }
});

// Delete a single user
const deleteaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const deleteaUser = await User.findByIdAndDelete(id);
    res.json({
      deleteaUser,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const getUserByID = asyncHandler(async (req, res) => {
  try {
    const UserId = req.params.id;
    const user = await User.findById(UserId);

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//block a user
// const blockUser = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   validateMongoDbId(id);
//   try {
//     const blockusr = await User.findByIdAndUpdate(
//       id,
//       { isBlocked: true },
//       { new: true }
//     );
//     if (!blockusr) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.json({ message: "User blocked successfully" });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });
const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  validateMongoDbId(id); // Make sure this function is correctly implemented

  try {
    const blockusr = await User.findByIdAndUpdate(
      id,
      { isBlocked: true },
      { new: true }
    );

    if (!blockusr) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error); // Log the error
    res.status(500).json({ message: error.message });
  }
});

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await User.findByIdAndUpdate(
      id,
      { isBlocked: false },
      { new: true }
    );
    if (!unblock) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// update password after login
const updatePassword = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { password } = req.body;
  validateMongoDbId(_id);
  const user = await User.findById(_id);
  if (password) {
    user.password = password;
    const updatedPassword = await user.save();
    res.json(updatedPassword);
  } else {
    res.json(user);
  }
});

// forgotPassword using token generation and sending email
const forgotPasswordToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found with this email");
  try {
    const token = await user.createPasswordResetToken();
    await user.save();
    const resetURL = `Hi, Please follow this link to reset Your Password. This link is valid till 10 minutes from now. <a href='http://localhost:5000/api/user/reset-password/${token}'>Click Here</>`;
    const data = {
      to: email,
      subject: "Forgot Password Link",
      html: resetURL,
    };
    sendEmail(data.to, data.subject, data.html);
    res.json({ message: "Email sent successfully", token: token });
  } catch (error) {
    throw new Error(error);
  }
});

// reset password after forgot password token generation and email sending to user
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) throw new Error(" Token Expired, Please try again later");
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json(user);
});

//get data of logged user
const getMe = async (req, res) => {
  res.json(req.user);
};

//Get data for corporate pods
const corporatePods = asyncHandler(async (req, res) => {
  const { companyName, email, phoneNumber } = req.body;

  const corporate = new Corporate({
    companyName,
    email,
    phoneNumber,
  });

  // Save the data to the database
  const savedData = await corporate.save();

  res.status(201).json({
    message: "Thanks for your Query",
    corporate: {
      _id: savedData._id,
      companyName: savedData.companyName,
      email: savedData.email,
      phoneNumber: savedData.phoneNumber,
    },
  });
});

// Apply Coupon on booking total amount
// const applyCoupon = asyncHandler(async (req, res) => {
//   const { coupon } = req.body;
//   const { _id } = req.user;
//   validateMongoDbId(_id);

//   const booking = await Booking.findOne({ _id });
//   if (!booking) {
//     throw new Error("Booking not found");
//   }
//   const validCoupon = await Coupon.findOne({ name: coupon });
//   if (!validCoupon) {
//     throw new Error("Invalid Coupon");
//   }
//   let { total } = booking;
//   const totalAfterDiscount = total - (total * validCoupon.discount) / 100;
//   booking.totalAfterDiscount = totalAfterDiscount;
//   await booking.save();

//   res.json({ totalAfterDiscount });
// });

// _______________________________________________________________________________________________

// Create availability
// start_time = 6 // 6 am
// end_time = 24 // till EOD
// indexes = (24-6)*60/15
// data = {
//   "product_id": id,
//   "slot_bookings": Array.from({ length: indexes }, () => false),
//   "available_slot":[]
// }
// ProductAvailability.create(data);

// Function to get slot index from time
function get_slot_index_from_time(time_obj, start_time) {
  console.log("Time object: ", time_obj);
  const hours = time_obj.getUTCHours();
  const minutes = time_obj.getUTCMinutes();
  console.log("time: ", hours, minutes);
  console.log("Index: ", (hours - start_time) * 4 + Math.floor(minutes / 15));
  return (hours - start_time) * 4 + Math.floor(minutes / 15);
}

const createBooking = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { podId } = req.params;
  validateMongoDbId(_id);
  validateMongoDbId(podId);
  try {
    const {
      bookingDate,
      startTime,
      endTime,
      timeSlotNumber,
      bookingPurpose,
      shortDescription,
      status,
      amountInCents,
      pricing, // ⭐ CHANGED 1 — the app now sends the line-item breakdown
      yocoCheckoutId,
      yocoMerchantId,
      yocoPaymentFacilitator,
      paymentGateway,   // "yoco" | "paystack"; older apps omit it and send yoco* fields
      paymentReference, // Paystack reference (or Yoco checkout id)
    } = req.body;

    console.log("Booking creation started:", req.body);

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pod = await productModel.findById(podId);
    if (!pod) {
      return res.status(404).json({ message: "Pod not found" });
    }
    console.log("pod", pod);
    const podstitle = pod.title; // Retrieve the pod title
    const deviceId = pod.deviceId;
    const UserID = pod.UserId;
    const serial = pod.serial;
    const password = pod.password;
    const hostemail = pod.email;

    const bookingDateObj = moment(bookingDate)
      .tz("Africa/Johannesburg")
      .toDate();
    const startTimeObj = moment(startTime).tz("Africa/Johannesburg").toDate();
    const endTimeObj = moment(endTime).tz("Africa/Johannesburg").toDate();

    console.log("startTimeObj:", startTimeObj);
    console.log("endTimeObj:", endTimeObj);
    console.log("bookingDateObj:", bookingDateObj);
    console.log("START_TIME:", START_TIME);

    const existingBooking = await Booking.findOne({
      podId,
      status: { $ne: "Cancelled" },
      $or: [
        {
          $and: [
            { startTime: { $lte: startTimeObj } },
            { endTime: { $gte: endTimeObj } },
          ],
        },
        {
          $and: [
            { startTime: { $lte: endTimeObj } },
            { endTime: { $gte: endTimeObj } },
          ],
        },
        {
          $and: [
            { startTime: { $gte: startTimeObj } },
            { endTime: { $lte: endTimeObj } },
          ],
        },
      ],
    });

    if (existingBooking) {
      console.log("Duplicate booking detected:", existingBooking);
      return res.status(400).json({
        message: "Booking with the same date and time already exists",
      });
    }

    const startTimeStamp = Math.floor(startTimeObj.getTime() / 1000);
    const endTimeStamp = Math.floor(endTimeObj.getTime() / 1000);
    const qrCodeDataString = `F2/${deviceId}/${UserID}/0/${endTimeStamp}/${startTimeStamp}`;

    // ---------------------------------------------------------------- payment
    // Work out which gateway paid for this booking. Older app builds only
    // send the yoco* fields, so fall back to Yoco when they are present.
    const paidCents = Number(amountInCents ?? pricing?.totalInCents ?? 0);
    const gateway =
      payments.normalizeGatewayName(paymentGateway) ||
      (yocoCheckoutId ? "yoco" : null);
    const reference = paymentReference || yocoCheckoutId || null;

    let paystackTxn = null;
    if (paidCents > 0 && gateway === "paystack") {
      // Never trust the redirect: confirm with Paystack that this reference
      // was paid, for at least this amount, and has not been used already.
      if (!reference) {
        return res.status(400).json({ message: "paymentReference is required for Paystack bookings" });
      }
      let verified;
      try {
        verified = await syncPaystackTransaction(reference);
      } catch (e) {
        console.error("Paystack verify failed during booking:", e.message);
        return res.status(502).json({ message: "Could not verify payment with Paystack. Please try again." });
      }
      const { result, txn } = verified;
      if (result.status !== "successful") {
        return res.status(402).json({ message: "Payment not completed", paymentStatus: result.status });
      }
      if (Number(result.amountInCents) < paidCents) {
        return res.status(402).json({
          message: "Paid amount does not match booking amount",
          paidInCents: result.amountInCents,
          expectedInCents: paidCents,
        });
      }
      if (txn.booking) {
        return res.status(409).json({ message: "This payment is already linked to a booking", bookingId: txn.booking });
      }
      paystackTxn = txn;
    }

    const newBooking = await Booking.create({
      user: user._id,
      podId,
      paymentGateway: paidCents > 0 ? gateway : null,
      paymentReference: paidCents > 0 ? reference : null,
      amountInCents: paidCents,
      podTitle: podstitle,
      serial: serial,
      password: password,
      Userid: UserID,
      bookingDate: bookingDateObj,
      startTime: startTimeObj,
      endTime: endTimeObj,
      timeSlotNumber,
      bookingPurpose,
      shortDescription: shortDescription || null,
      status: status,
      qrCodeData: qrCodeDataString,
      feedback: {
        message: null,
        rating: null,
      },
    });

    user.booking.push(newBooking._id);
    await user.save();

    // update location booking count
    const bookingPod = await productModel.findById(podId).select("location");
    if (bookingPod && bookingPod.location) {
      await Location.findByIdAndUpdate(bookingPod.location, {
        $push: { booking: newBooking._id },
      });
    }

    // Record the payment whenever money actually changed hands, and link the
    // Transaction row to the booking so the admin can look it up by id.
    let transactionDoc = null;
    if (paidCents > 0) {
      if (paystackTxn) {
        transactionDoc = await Transaction.findByIdAndUpdate(
          paystackTxn._id,
          { $set: { booking: newBooking._id, user: user._id, status: "successful" } },
          { new: true }
        );
      } else {
        transactionDoc = await Transaction.create({
          amount: paidCents,
          currency: "ZAR",
          gateway: gateway || "yoco",
          reference,
          merchantId: yocoMerchantId || "N/A",
          checkoutId: yocoCheckoutId || reference || null,
          paymentFacilitator: yocoPaymentFacilitator || "yoco-online-checkout",
          status: "successful",
          booking: newBooking._id,
          user: user._id,
          customerEmail: user.email || null,
        });
      }
      newBooking.transaction = transactionDoc._id;
      await newBooking.save();
    }

    const productAvailability = await ProductAvailability.findOne({
      product_id: podId,
      booking_date: {
        $gte: new Date(
          bookingDateObj.getFullYear(),
          bookingDateObj.getMonth(),
          bookingDateObj.getDate()
        ),
        $lt: new Date(
          bookingDateObj.getFullYear(),
          bookingDateObj.getMonth(),
          bookingDateObj.getDate() + 1
        ),
      },
    });

    console.log("Product availablity backend", productAvailability);

    if (productAvailability) {
      let updatedSlotBookings = productAvailability.slot_bookings;
      const startingIndex = get_slot_index_from_time(startTimeObj, START_TIME);
      const endingIndex = get_slot_index_from_time(endTimeObj, START_TIME);
      console.log("Indices: ", startingIndex, endingIndex);
      for (let i = startingIndex; i < endingIndex; i++) {
        updatedSlotBookings[i] = true;
        console.log(`Slot ${i} marked as true`);
      }
      console.log("Starting index:", startingIndex, "Ending index:", endingIndex);
      console.log("Before update:", updatedSlotBookings);

      const newAvailablity = await ProductAvailability.findOneAndUpdate(
        { _id: productAvailability._id },
        { slot_bookings: updatedSlotBookings },
        { new: true }
      );
      console.log("hg", newAvailablity);
    } else {
      const indexes = (END_TIME - START_TIME) * 4;
      const slotBookings = Array.from({ length: indexes }, () => false);
      const startingIndex = get_slot_index_from_time(startTimeObj, START_TIME);
      const endingIndex = get_slot_index_from_time(endTimeObj, START_TIME);
      for (let i = startingIndex; i < endingIndex; i++) {
        slotBookings[i] = true;
      }
      const data = {
        product_id: podId,
        slot_bookings: slotBookings,
        booking_date: bookingDateObj,
      };
      await ProductAvailability.create(data);
    }

    // ⭐ CHANGED 3 — build the payment context the invoice needs. Without this
    // generateInvoicePDF had no real amount and invented one from pod.price.
    const paymentInfo = {
      amountInCents: paidCents,
      currency: "ZAR",
      gateway: paidCents > 0 ? gateway : null,
      checkoutId: reference,
      merchantId: yocoMerchantId || null,
      paymentFacilitator:
        gateway === "paystack"
          ? "Paystack"
          : yocoPaymentFacilitator || "yoco-online-checkout",
      pricing: pricing || null,
    };

    // ⭐ CHANGED 4 — pass paymentInfo, and attach .catch() to both. These run
    // detached from the request; an unhandled rejection here can kill the
    // process, and an email failure must never fail an already-saved booking.
    sendNotificationOnBooking(user, newBooking, paymentInfo).catch((e) =>
      console.error("booking email failed:", e)
    );
    sendNotificationOnHost(user, newBooking, hostemail).catch((e) =>
      console.error("host email failed:", e)
    );

    console.log("Booking created successfully:", newBooking._id);
    res.status(201).json({
      message: "Booking created successfully",
      booking: {
        ...newBooking.toObject(),
      },
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// const sendNotificationOnBooking = asyncHandler(
//   async (user = null, booking, userId = null) => {
//    console.log("bookingimp", booking)
//     try {
//       if (!user && !userId) {
//         throw new Error("Any one of User or UserId is required");
//       }
//       if (!user) {
//         user = await User.findById(userId);
//       }
//       if (!user) throw new Error("User not found");

//       booking = booking.populate("podId");
//       if (!booking) throw new Error("Booking not found");

//       // Format booking date and times
//       const formattedBookingDate = booking.bookingDate.toDateString();
//       const formattedStartTime = moment(booking.startTime)
//         // .tz("Africa/Johannesburg")
//         .format("hh:mm A");
//       const formattedEndTime = moment(booking.endTime)
//         // .tz("Africa/Johannesburg")
//         .format("hh:mm A");

//       // Construct email content
//       const emailContent = `
//       <p>Hi ${user.firstname},</p>
//       <p>Your booking details:</p>
//       <ul>
//         <li><strong>Booking ID:</strong> ${booking._id}</li>
//         <li><strong>Booking Date:</strong> ${formattedBookingDate}</li>
//         <li><strong>Start Time:</strong> ${formattedStartTime}</li>
//         <li><strong>End Time:</strong> ${formattedEndTime}</li>
//         <li><strong>Pod ID:</strong> ${booking.podId}</li>
//         <li><strong>Pod Title:</strong> ${booking.podTitle}</li>
//       </ul>
//       <p>Thank you for booking with us!</p>
//     `;

//       // Send email
//       const data = {
//         to: user.email,
//         subject: "Booking Notification",
//         html: emailContent,
//       };
//       await sendEmail(data.to, data.subject, data.html);
//       console.log("Email sent successfully.");
//     } catch (error) {
//       console.error("Error sending notification:", error.message);
//       throw new Error("Failed to send notification");
//     }
//   }
// );

const resolvePodLocation = async (pod) => {
  if (!pod?.location) return null;
  try {
    const loc = await Location.findById(pod.location);
    if (!loc) return null;
    return (
      [loc.name, loc.address, loc.city].filter(Boolean).join(", ") || null
    );
  } catch (err) {
    console.error("resolvePodLocation failed:", err.message);
    return null;
  }
};

/* ------------------------------ email shell ---------------------------- */
// Table-based with inline styles. Gmail strips <style> blocks and Outlook
// (Word rendering engine) ignores flex/grid, so everything is <table> + inline.
const emailShell = ({ title, intro, rows, footNote }) => {
  const row = ([k, v]) => `
    <tr>
      <td style="padding:9px 0;font:400 13px/18px Arial,Helvetica,sans-serif;color:#6B7280;width:42%;" valign="top">${k}</td>
      <td style="padding:9px 0;font:700 13px/18px Arial,Helvetica,sans-serif;color:#1A1A1A;" valign="top">${v}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
    <tr><td align="center" style="padding:24px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;">

        <tr><td style="height:4px;background:#E90E8B;font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr><td style="padding:28px 32px 8px 32px;">
          <p style="margin:0;font:700 20px/26px Arial,Helvetica,sans-serif;color:#1A1A1A;">${title}</p>
        </td></tr>

        <tr><td style="padding:0 32px 16px 32px;">
          <p style="margin:0;font:400 14px/21px Arial,Helvetica,sans-serif;color:#4B5563;">${intro}</p>
        </td></tr>

        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:#F8F9FB;border-radius:8px;">
            <tr><td style="padding:6px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows.map(row).join("")}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 32px 28px 32px;">
          <p style="margin:0;font:400 13px/20px Arial,Helvetica,sans-serif;color:#6B7280;">${footNote}</p>
        </td></tr>

      </table>

      <p style="margin:16px 0 0 0;font:400 11px/16px Arial,Helvetica,sans-serif;color:#9CA3AF;">
        Privily · <a href="https://privily.co" style="color:#9CA3AF;">privily.co</a>
      </p>

    </td></tr>
  </table>
</body></html>`;
};



const sendNotificationOnBooking = async (user = null, booking, payment = {}, userId = null) => {
  let invoicePath = null;
  try {
    if (!user && !userId) throw new Error("Any one of User or UserId is required");
    if (!user) user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (!booking) throw new Error("Booking not found");

    // Always work with a plain pod document.
    const pod =
      booking.podId && booking.podId.title
        ? booking.podId
        : await productModel.findById(booking.podId);

    const locationName = await resolvePodLocation(pod);

    const { filepath, invoiceNumber, totalInCents } = await generateInvoicePDF(
      user,
      booking,
      { ...payment, locationName }
    );
    invoicePath = filepath;

    const rows = [
      ["Invoice number", invoiceNumber],
      ["Pod", booking.podTitle || pod?.title || "—"],
      ["Location", locationName || "—"],
      ["Date", moment(booking.bookingDate).format("D MMMM YYYY")],
      [
        "Time",
        `${moment(booking.startTime).format("HH:mm")} – ${moment(booking.endTime).format("HH:mm")}`,
      ],
      ["Amount paid", zar(totalInCents)],
      ["Booking reference", String(booking._id).slice(-8).toUpperCase()],
    ];

    const html = emailShell({
      title: "Your booking is confirmed",
      intro: `Hi ${user.firstname || "there"}, thanks for booking with Privily. Your tax invoice is attached as a PDF.`,
      rows,
      footNote:
        "Show the QR code in the app when you arrive. Need help? Just reply to this email.",
    });

    await sendEmail(user.email, `Booking confirmed · ${invoiceNumber}`, html, [
      {
        filename: `${invoiceNumber}.pdf`,
        path: filepath,
        contentType: "application/pdf",
      },
    ]);

    console.log(`Invoice ${invoiceNumber} emailed to ${user.email}`);
  } catch (error) {
    // Never rethrow: this runs detached from the request, and an unhandled
    // rejection here can take the process down. The booking already succeeded.
    console.error("sendNotificationOnBooking failed:", error);
  } finally {
    if (invoicePath && fs.existsSync(invoicePath)) {
      fs.promises.unlink(invoicePath).catch(() => {});
    }
  }
};

/* ----------------------------- host notice ----------------------------- */
const sendNotificationOnHost = async (user, booking, hostemail) => {
  try {
    if (!hostemail) return;
    if (!booking) throw new Error("Booking not found");

    // The old code did `booking = booking.populate("podId")` with NO await,
    // so booking became a Promise and booking.bookingDate was undefined —
    // this function threw on every single booking.
    const pod =
      booking.podId && booking.podId.title
        ? booking.podId
        : await productModel.findById(booking.podId);

    const locationName = await resolvePodLocation(pod);
    const guest =
      [user?.firstname, user?.lastname].filter(Boolean).join(" ") || "A guest";

    const html = emailShell({
      title: "New booking for your pod",
      intro: `${guest} has booked ${booking.podTitle || pod?.title || "your pod"}.`,
      rows: [
        ["Guest", guest],
        ["Contact", user?.email || "—"],
        ["Pod", booking.podTitle || pod?.title || "—"],
        ["Location", locationName || "—"],
        ["Date", moment(booking.bookingDate).format("D MMMM YYYY")],
        [
          "Time",
          `${moment(booking.startTime).format("HH:mm")} – ${moment(booking.endTime).format("HH:mm")}`,
        ],
        ["Booking reference", String(booking._id).slice(-8).toUpperCase()],
      ],
      footNote: "No action is needed — the guest has already paid.",
    });

    await sendEmail(hostemail, "New booking for your pod", html);
  } catch (error) {
    console.error("sendNotificationOnHost failed:", error);
  }
};
//extend booking time
const extendBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { extensionMinutes } = req.body; // Expecting the requested extension time in minutes

  validateMongoDbId(bookingId);

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const podId = booking.podId;
    const endTimeObj = new Date(booking.endTime);

    // Fetch ProductAvailability for the given date
    const bookingDateObj = new Date(booking.bookingDate);
    let productAvailability = await ProductAvailability.findOne({
      product_id: podId,
      booking_date: {
        $gte: new Date(
          bookingDateObj.getFullYear(),
          bookingDateObj.getMonth(),
          bookingDateObj.getDate()
        ),
        $lt: new Date(
          bookingDateObj.getFullYear(),
          bookingDateObj.getMonth(),
          bookingDateObj.getDate() + 1
        ),
      },
    });

    if (!productAvailability) {
      const indexes = (END_TIME - START_TIME) * 4;
      const slotBookings = Array.from({ length: indexes }, () => false);
      productAvailability = new ProductAvailability({
        product_id: podId,
        slot_bookings: slotBookings,
        booking_date: bookingDateObj,
      });
      await productAvailability.save();
    }

    // Calculate the new end time
    const newEndTimeObj = new Date(
      endTimeObj.getTime() + extensionMinutes * 60000
    );
    const currentEndingIndex = get_slot_index_from_time(endTimeObj, START_TIME);
    const newEndingIndex = get_slot_index_from_time(newEndTimeObj, START_TIME);

    // Update slot bookings in ProductAvailability
    const slotBookings = productAvailability.slot_bookings;
    for (let i = currentEndingIndex; i < newEndingIndex; i++) {
      if (slotBookings[i]) {
        return res.status(400).json({
          message: "Slot not available for the requested extension time.",
        });
      }
      slotBookings[i] = true;
    }

    await ProductAvailability.findOneAndUpdate(
      { _id: productAvailability._id },
      { slot_bookings: slotBookings },
      { new: true }
    );

    // Update booking endTime
    booking.endTime = newEndTimeObj;
    booking.qrCodeData = `F2/33346/629039/0/${Math.floor(
      newEndTimeObj.getTime() / 1000
    )}/${Math.floor(new Date(booking.startTime).getTime() / 1000)}`;
    await booking.save();

    // Convert the updated booking times to IST for the response
    const responseBooking = {
      ...booking._doc,
      bookingDate: moment(booking.bookingDate).format(),
      startTime: moment(booking.startTime).format(),
      endTime: moment(booking.endTime).format(),
    };

    return res.status(200).json({
      message: "Booking extended successfully",
      booking: responseBooking,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
const getBookingsByUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    await updateBookingStatusAutomatically(req, res, async () => {});

    const user = await User.findById(_id).populate("booking");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const bookings = user.booking;
    console.log("bookings", bookings);
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings by user:", error); // Log the error for debugging
    res.status(500).json({
      status: "fail",
      message: "An error occurred while fetching bookings by user.",
    });
  }
});


// const getBookings = asyncHandler(async (req, res) => {
//   try {
//     await updateBookingStatusAutomatically(req, res, async () => {});

//     const allBookings = await Booking.find();
//     res.json(allBookings);
//   } catch (error) {
//     throw new Error(error);
//   }
// });

// const getBookings = asyncHandler(async (req, res) => {
//   try {
//     await updateBookingStatusAutomatically(req, res, async () => {});

//     // Get all bookings
//     const allBookings = await Booking.find();

//     // Loop through all bookings to populate user and location details
//     const bookingsWithDetails = await Promise.all(
//       allBookings.map(async (booking) => {
//         const user = await User.findById(booking.user);
//         const username = user ? user.firstname + ""+ user.lastname : "Unknown";

//         const location = await productModel.findById(booking.podId);
//         console.log("location", location);
//         const locationName = location ? location.location : "Unknown";

//         // Return the booking with user and location details
//         return {
//           ...booking.toObject(),
//           username,
//           locationName,
//         };
//       })
//     );

//     res.json(bookingsWithDetails);
//   } catch (error) {
//     throw new Error(error);
//   }
// });
const getBookings = asyncHandler(async (req, res) => {
  try {
    await updateBookingStatusAutomatically(req, res, async () => {});

    const allBookings = await Booking.find();

    const bookingsWithDetails = await Promise.all(
      allBookings.map(async (booking) => {
        const user = await User.findById(booking.user);
        const username = user
          ? `${user.firstname} ${user.lastname}`
          : "Unknown";

        const pod = await productModel.findById(booking.podId);
        let locationName = "Unknown";
        let locationDetails = null;

        if (bookingPod && bookingPod.location) {
          // ✅ Assuming you have a Location model imported
          const Location = require("../models/locationModel"); // adjust path as needed
          locationDetails = await Location.findById(pod.location);
          locationName = locationDetails?.name || "Unknown";
        }

        return {
          ...booking.toObject(),
          username,
          locationName,
          locationDetails, // you can return full location object if needed
        };
      })
    );

    res.json(bookingsWithDetails);
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
});

const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const booking = await Booking.findById(id).populate("user").exec();
    res.json(booking);
  } catch (error) {
    throw new Error(error);
  }
});


// const generateInvoicePdfBuffer = (booking, user) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument();
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     // Compose PDF content
//     doc.fontSize(20).text("Invoice for your Booking", { align: "center" });
//     doc.moveDown();

//     doc.fontSize(14).text(`Booking ID: ${booking._id}`);
//     doc.text(`Name: ${user.firstname} ${user.lastname}`);
//     doc.text(`Email: ${user.email}`);
//     doc.text(`Booking Date: ${booking.bookingDate.toDateString()}`);
//     doc.text(`Start Time: ${booking.startTime.toLocaleTimeString()}`);
//     doc.text(`End Time: ${booking.endTime.toLocaleTimeString()}`);
//     doc.text(`Purpose: ${booking.bookingPurpose || "N/A"}`);

//     // Add more invoice details like price, taxes, total etc.
//     doc.moveDown();
//     doc.text(`Total Amount: ZAR XXXX`); // You can calculate or fetch this from booking/payment info

//     doc.end();
//   });
// };


// const generateInvoicePdfBuffer = (booking, user) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ margin: 50 });
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     // COMPANY HEADER
//     doc.fontSize(16).text("Privily (Pty) Ltd", { align: "left" });
//     doc.fontSize(10).text("Reg. No.: 2023/832609/07");
//     doc.text("9 Mt. Orville, Midlands Estate, Midstream");
//     doc.text("Vat No.: 4890315445");
//     doc.text("Ph: (+27) 082 4412152 / (+27) 083 212 8647");
//     doc.moveDown();

//     // INVOICE METADATA
//     doc.fontSize(14).text(`Tax Invoice # ${booking.invoiceNumber || "XXXX"}`, {
//       align: "right",
//     });
//     doc.fontSize(10).text(`Invoice Date: ${new Date().toLocaleDateString()}`, {
//       align: "right",
//     });
//     doc.text(
//       `Due Date: ${
//         booking.dueDate?.toLocaleDateString() || "10 days from invoice"
//       }`,
//       { align: "right" }
//     );
//     doc.text(`Invoice No.: ${booking.invoiceNumber || "0001"}`, {
//       align: "right",
//     });

//     doc.moveDown();

//     // BILL TO
//     doc.fontSize(12).text("BILL TO:", { underline: true });
//     doc.text(`${user.firstname} ${user.lastname}`);
//     doc.text(user.email);
//     if (user.company) doc.text(user.company);
//     if (user.vatNumber) doc.text(`VAT No.: ${user.vatNumber}`);
//     doc.moveDown();

//     // TABLE HEADER
//     doc.font("Helvetica-Bold");
//     doc.text("DESCRIPTION", 50, doc.y, { continued: true });
//     doc.text("UNIT", 250, doc.y, { continued: true });
//     doc.text("QTY", 300, doc.y, { continued: true });
//     doc.text("DURATION", 350, doc.y, { continued: true });
//     doc.text("RATE", 420, doc.y, { continued: true });
//     doc.text("TOTAL", 480, doc.y);
//     doc.moveDown();
//     doc.font("Helvetica");
//     if (Array.isArray(booking.items) && booking.items.length > 0) {
//       booking.items.forEach((item) => {
//         doc.text(item.description, 50, doc.y, { continued: true });
//         doc.text(item.unit, 250, doc.y, { continued: true });
//         doc.text(item.qty.toString(), 300, doc.y, { continued: true });
//         doc.text(item.duration, 350, doc.y, { continued: true });
//         doc.text(`R ${item.rate.toLocaleString()}`, 420, doc.y, {
//           continued: true,
//         });
//         doc.text(`R ${item.total.toLocaleString()}`, 480, doc.y);
//         doc.moveDown();
//       });
//     } else {
//       console.log("No items available in the booking.");
//       doc.text("No items available.", 50, doc.y);
//     }
//     doc.moveDown();
//     const subtotal = booking.subtotal || 24000;
//     const vat = booking.vat || subtotal * 0.15;
//     const total = subtotal + vat;

//     doc.font("Helvetica-Bold");
//     doc.text(`SUBTOTAL`, 420, doc.y, { continued: true });
//     doc.text(`R ${subtotal.toLocaleString()}`, 480, doc.y);
//     doc.text(`VAT`, 420, doc.y, { continued: true });
//     doc.text(`R ${vat.toLocaleString()}`, 480, doc.y);
//     doc.text(`TOTAL`, 420, doc.y, { continued: true });
//     doc.text(`R ${total.toLocaleString()}`, 480, doc.y);
//     doc.font("Helvetica");

//     doc.moveDown();

//     // BANK DETAILS
//     doc.fontSize(10);
//     doc.text("Bank Details:");
//     doc.text("Privily (Pty) Ltd");
//     doc.text("Standard Bank, Branch: 002645");
//     doc.text("Account: 10 20 085 0707");
//     doc.text("SWIFT: SBZAZAJJ");

//     doc.moveDown();
//     doc.text(
//       `Event: Fame Week Africa - Soundproof Pods - ${
//         booking.eventStartDate || "02 Sept 2024"
//       } to ${booking.eventEndDate || "04 Sept 2024"}`
//     );

//     doc.end();
//   });
// };
// const drawTable = (doc, booking, duration, rate, bookingTotal) => {
//   const tableTop = doc.y;
//   const rowHeight = 20;
//   const columnWidths = [240, 50, 50, 70, 70, 70];
//   const tableWidth = columnWidths.reduce((acc, width) => acc + width, 0);
//   const cellPadding = 5;

//   doc
//     .font("Helvetica-Bold")
//     .text("DESCRIPTION", 50 + cellPadding, tableTop, {
//       width: columnWidths[0] - cellPadding,
//       align: "left",
//     })
//     .text("DURATION", 400, tableTop, {
//       width: columnWidths[3],
//       align: "center",
//     })
//     .text("RATE", 470, tableTop, { width: columnWidths[4], align: "center" })
//     .text("TOTAL", 540, tableTop, { width: columnWidths[5], align: "center" });

//   // Header row border
//   doc.rect(50, tableTop - 5, tableWidth, rowHeight).stroke();

//   const rowTop = tableTop + rowHeight;

//   doc
//     .font("Helvetica")
//     .text(booking.podTitle, 50 + cellPadding, rowTop, {
//       width: columnWidths[0] - cellPadding,
//       align: "left",
//     })

//     .text(`R ${rate.toLocaleString()}`, 470, rowTop, {
//       width: columnWidths[4],
//       align: "center",
//     })
//     .text(duration, 400, rowTop, {
//       width: columnWidths[3],
//       align: "center",
//     })
//     .text(`R ${bookingTotal.toLocaleString()}`, 540, rowTop, {
//       width: columnWidths[5],
//       align: "center",
//     });

//   // Row border
//   doc.rect(50, rowTop - 5, tableWidth, rowHeight).stroke();

//   return rowTop + rowHeight;
// };


// const generateInvoicePdfBuffer = async (booking, user) => {
//   console.log("booking",booking)
// const pod = await productModel.findById(booking.podId);
// console.log("pod",pod)
// const rate = pod?.rate;
// console.log("rate", rate);

// const startTime = new Date(booking.startTime);
// const endTime = new Date(booking.endTime);

// console.log("pods", startTime,endTime);


// const durationInMinutes = Math.round((endTime - startTime) / (1000 * 60)); // 1 min = 60,000 ms
// const duration = `${durationInMinutes}`;
// const bookingTotal = durationInMinutes * rate;
// console.log("duration", duration, rate, bookingTotal);

//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ margin: 50 });
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     // COMPANY HEADER
//     doc.image(logoPath, 50, 50, { width: 200 });
//     doc.fontSize(16).text("Privily (Pty) Ltd", { align: "right" });
//     doc.fontSize(10).text("Reg. No.: 2023/832609/07", { align: "right" });
//     doc.text("9 Mt. Orville, Midlands Estate, Midstream", { align: "right" });
//     doc.text("Vat No.: 4890315445", { align: "right" });
//     doc.text("Ph: (+27) 082 4412152 / (+27) 083 212 8647", { align: "right" });
//     doc.moveDown();

//     // INVOICE METADATA
//     doc.fontSize(14).text(`Tax Invoice`, {
//       align: "center",
//     });

//     doc.moveDown();

//     // BILL TO
//     doc.fontSize(12).text("BILL TO:", { underline: true });
//     doc.text(`${booking.user.firstname} ${booking.user.lastname}`);
//     doc.text(booking.user.email);
//     if (user.company) doc.text(user.company);
//     if (user.vatNumber) doc.text(`VAT No.: ${user.vatNumber}`);
//     doc.fontSize(10).text(`Invoice Date: ${new Date().toLocaleDateString()}`, {
//       align: "right",
//     });
//     doc.text(`Invoice No.: ${booking.invoiceNumber || "0001"}`, {
//       align: "right",
//     });
//     doc.moveDown();

//     // Draw the table with the items
//     const tableHeight = drawTable(doc, booking, rate, duration, bookingTotal);

//     // Subtotal, VAT, and Total
// const subtotal = bookingTotal;
// const vat = subtotal * 0.15;
// const grandTotal = subtotal;

//     const columnWidths = [240, 50, 50, 70, 70, 70];
//     const tableStartX = 50;
//     const totalColumnX =
//       tableStartX + columnWidths.slice(0, 5).reduce((sum, w) => sum + w, 0);

//     const totalColumnWidth = columnWidths[5]; // 70
//     const labelX = totalColumnX - 80;
//     const valueX = totalColumnX;

//     // Subtotal
//       doc.text("VAT", labelX, tableHeight + 40);
//       doc.text(`R ${vat.toLocaleString()}`, valueX, tableHeight + 40, {
//         width: totalColumnWidth,
//         align: "left",
//       });
//     // Total
//     doc.text("TOTAL", labelX, tableHeight + 60);
//     doc.text(`R ${grandTotal.toLocaleString()}`, valueX, tableHeight + 60, {
//       width: totalColumnWidth,
//       align: "left",
//     });

//     doc.font("Helvetica");

//     doc.moveDown();

//     // BANK DETAILS
//     doc.fontSize(10);
//     doc.text("Bank Details:", 50, doc.y, { align: "left" });
//     doc.text("Privily (Pty) Ltd", 50, doc.y, { align: "left" });
//     doc.text("Standard Bank, Branch: 002645", 50, doc.y + 10, {
//       align: "left",
//     });
//     doc.text("Account: 10 20 085 0707", 50, doc.y, { align: "left" });
//     doc.text("SWIFT: SBZAZAJJ", 50, doc.y, { align: "left" });

//     // Add space after the bank details
//     doc.moveDown();

//     // doc.text(
//     //   `Event: Fame Week Africa - Soundproof Pods - ${
//     //     booking.eventStartDate || "02 Sept 2024"
//     //   } to ${booking.eventEndDate || "04 Sept 2024"}`
//     // );

//     doc.end();
//   });
// };

// // const generateInvoicePdfBuffer = async (booking, user) => {
// //   // Add timeout wrapper
// //   return Promise.race([
// //     new Promise((resolve, reject) => {
// //       // Your existing PDF generation code
// //       const doc = new PDFDocument({ margin: 50 });
// //       const buffers = [];

// //       // Set a timeout for PDF generation
// //       const timeout = setTimeout(() => {
// //         reject(new Error("PDF generation timeout"));
// //       }, 30000); // 30 seconds

// //       doc.on("data", buffers.push.bind(buffers));
// //       doc.on("end", () => {
// //         clearTimeout(timeout);
// //         const pdfData = Buffer.concat(buffers);
// //         resolve(pdfData);
// //       });

// //       // Rest of your PDF code...
// //     }),
// //     new Promise((_, reject) =>
// //       setTimeout(() => reject(new Error("PDF generation timeout")), 30000)
// //     ),
// //   ]);
// // };
// const sendInvoiceEmailWithAttachment = async (booking, user) => {
//   const pdfBuffer = await generateInvoicePdfBuffer(booking, user);

//   const mailOptions = {
//     to: user.email,
//     subject: "Your Booking Invoice",
//     html: `<p>Dear ${user.firstname},</p><p>Please find attached the invoice for your booking.</p>`,
//     attachments: [
//       {
//         filename: `invoice_${booking._id}.pdf`,
//         content: pdfBuffer,
//         contentType: "application/pdf",
//       },
//     ],
//   };

//   await sendEmail(
//     mailOptions.to,
//     mailOptions.subject,
//     mailOptions.html,
//     mailOptions.attachments
//   );
// };
// // const sendInvoiceEmail = asyncHandler(async (req, res) => {
// //   const { bookingId } = req.params;
// //   validateMongoDbId(bookingId);

// //   const booking = await Booking.findById(bookingId).populate("user");

// //   if (!booking) {
// //     return res.status(404).json({ message: "Booking not found" });
// //   }

// //   const user = booking.user;
// //   if (!user) {
// //     return res.status(404).json({ message: "User not found" });
// //   }

// //   await sendInvoiceEmailWithAttachment(booking, user);

// //   res.json({ message: "Invoice PDF sent successfully" });
// // });

// const sendInvoiceEmail = asyncHandler(async (req, res) => {
//   const { bookingId } = req.params;
//   validateMongoDbId(bookingId);

//   console.log(`Starting invoice generation for booking: ${bookingId}`);
//   const startTime = Date.now();

//   try {
//     const booking = await Booking.findById(bookingId).populate("user");

//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found" });
//     }

//     const user = booking.user;
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     console.log(`Generating PDF for user: ${user.email}`);
//     await sendInvoiceEmailWithAttachment(booking, user);

//     const endTime = Date.now();
//     console.log(`Invoice sent successfully in ${endTime - startTime}ms`);

//     res.json({ message: "Invoice PDF sent successfully" });
//   } catch (error) {
//     const endTime = Date.now();
//     console.error(
//       `Invoice generation failed after ${endTime - startTime}ms:`,
//       error
//     );

//     res.status(500).json({
//       message: "Failed to send invoice",
//       error: error.message,
//     });
//   }
// });



const updateBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const updatedBooking = await Booking.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json(updatedBooking);
    sendNotificationOnUpdate(
      req.user._id, // Assuming req.user contains user information
      updatedBooking._id,
      Object.keys(req.body) // Pass updated fields to sendNotificationOnUpdate
    );
  } catch (error) {
    throw new Error(error);
  }
});

const sendNotificationOnUpdate = asyncHandler(
  async (userId, bookingId, updatedFields) => {
    validateMongoDbId(userId);
    validateMongoDbId(bookingId);

    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking not found");

      let emailContent = "";

      // Check if relevant fields are updated
      if (updatedFields && updatedFields.length > 0) {
        const relevantFields = updatedFields.filter((field) => {
          // Add conditions here based on user preferences and booking fields
          return (
            field === "status" ||
            field === "bookingDate" ||
            field === "startTime" ||
            field === "endTime"
          );
        });

        if (relevantFields.length > 0) {
          // Construct notification message based on updated fields
          emailContent = `
          <p>Hi ${user.firstname},</p>
          <p>Your booking details have been updated. Here are the changes:</p>
          <ul>
            ${relevantFields
              .map(
                (field) =>
                  `<li><strong>${field}:</strong> ${booking[field]}</li>`
              )
              .join("\n")}
          </ul>
          <p>If you have any questions or concerns, please feel free to contact us.</p>
        `;
        }
      }

      // If email content exists, send email
      if (emailContent) {
        const data = {
          to: user.email,
          subject: "Booking Update Notification",
          html: emailContent,
        };
        await sendEmail(data.to, data.subject, data.html); // Send email
      }
    } catch (error) {
      console.error("Error sending update notification:", error.message);
      throw new Error("Failed to send update notification");
    }
  }
);
// cancle booking by id for user only if the booking status is pending and confirmed
const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status !== "Pending" && booking.status !== "Confirmed") {
      return res.status(403).json({
        message:
          "Cannot cancel booking with status other than Pending or Confirmed",
      });
    }
    // Check if booking's start time is within the last 5 minutes
    const fiveMinutesAgo = new Date(new Date() - 300 * 1000);
    if (booking.startTime < fiveMinutesAgo) {
      return res.status(403).json({
        message: "Cannot cancel booking Before 5 Minutes of start time",
      });
    }

    // If status is pending or confirmed, update status to "Cancelled"
    updatedStatus = "Cancelled";
    sendNotificationOnCancel(booking.user._id, booking._id);
    updatedIsBookingActive = false;
    try {
      // await booking.save();
      const updatedBooking = await Booking.findByIdAndUpdate(booking._id, {
        status: updatedStatus,
        isBookingActive: updatedIsBookingActive,
      }, {new:true});
    } catch (error) {
      console.log("booking save nahi ho rahi hai", error);
    }

    // Update product availability
    const productAvailability = await ProductAvailability.findOne({
      product_id: booking.podId,
      booking_date: {
        $gte: new Date(
          booking.bookingDate.getFullYear(),
          booking.bookingDate.getMonth(),
          booking.bookingDate.getDate()
        ),
        $lt: new Date(
          booking.bookingDate.getFullYear(),
          booking.bookingDate.getMonth(),
          booking.bookingDate.getDate() + 1
        ),
      },
    });

    if (productAvailability) {
      let updatedSlotBookings = productAvailability.slot_bookings;
      const startingIndex = get_slot_index_from_time(
        booking.startTime,
        START_TIME
      );
      const endingIndex = get_slot_index_from_time(booking.endTime, START_TIME);
      for (let i = startingIndex; i < endingIndex; i++) {
        updatedSlotBookings[i] = false;
      }

      await ProductAvailability.findOneAndUpdate(
        { _id: productAvailability._id },
        { slot_bookings: updatedSlotBookings },
        { new: true }
      );
    }

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// const cancelBooking = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   validateMongoDbId(id);
//   try {
//     const booking = await Booking.findById(id);

//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found" });
//     }
//     if (booking.status !== "Pending" && booking.status !== "Confirmed") {
//       return res.status(403).json({
//         message:
//           "Cannot cancel booking with status other than Pending or Confirmed",
//       });
//     }
//     // Check if booking's start time is within the last 5 minutes
//     const fiveMinutesAgo = new Date(new Date() - 300 * 1000);
//     console.log(fiveMinutesAgo, 'timing')
//     console.log(booking.startTime, "start Time")
//     if (booking.startTime < fiveMinutesAgo) {
//       return res.status(403).json({
//         message: "Cannot cancel booking Before 5 Minutes of start time",
//       });
//     }

//     // If status is pending or confirmed, update status to "Cancelled"
//     booking.status = "Cancelled";
//     sendNotificationOnCancel(booking.user._id, booking._id);
//     booking.isBookingActive = false;
//     await booking.save();

//     res.json({ message: "Booking cancelled successfully", booking });
//   } catch (error) {
//     throw new Error(error);
//   }
// });

const bookingFeedback = asyncHandler(async (req, res) => {
  try {
    const booking_id = req.params.id;
    const { message, rating } = req.body;
    await Booking.findById(booking_id);
    const updatedBooking = await Booking.findByIdAndUpdate(
      booking_id,
      { "feedback.rating": rating, "feedback.message": message },
      {
        new: true,
      }
    );
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const sendNotificationOnCancel = asyncHandler(async (userId, bookingId) => {
  validateMongoDbId(userId);
  validateMongoDbId(bookingId);

  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    let emailContent = "";

    // If booking status has changed, send notification
    if (booking.status == "Cancelled") {
      // Format booking date and times
      const formattedBookingDate = booking.bookingDate.toDateString();
      const formattedStartTime = booking.startTime.toLocaleTimeString("en-US", {
        hour12: true,
      });
      const formattedEndTime = booking.endTime.toLocaleTimeString("en-US", {
        hour12: true,
      });

      emailContent = `
        <p>Hi ${user.firstname},</p>
        <p>We regret to inform you that your booking has been cancelled.</p>
        <p>Here are the details of your booking:</p>
        <ul>
          <li><strong>Booking ID:</strong> ${booking._id}</li>
          <li><strong>Booking Date:</strong> ${formattedBookingDate}</li>
          <li><strong>Start Time:</strong> ${formattedStartTime}</li>
          <li><strong>End Time:</strong> ${formattedEndTime}</li>
          <li><strong>Pod ID:</strong> ${booking.podId}</li> <!-- Assuming 'podId' is the property for pod ID -->
          <!-- Include other necessary details -->
        </ul>
        <p>We apologize for any inconvenience caused.</p>
      `;
      user.lastBookingStatus = booking.status; // Update user's last booking status
    }
    // If email content exists, send email
    if (emailContent) {
      const data = {
        to: user.email,
        subject: "Booking Cancellation Notification",
        html: emailContent,
      };

      await sendEmail(data.to, data.subject, data.html); // Send email
    }

    await user.save(); // Save changes to user
  } catch (error) {
    console.error("Error sending cancellation notification:", error.message);
    throw new Error("Failed to send cancellation notification");
  }
});
const updateBookingStatusAutomatically = async (req, res, next) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    // const now = new Date();
    // const updatedTime = new Date(now.setHours(now.getHours() + 2));
    const now = moment();
    const updatedTime = now.add(2, "hours");
    // Find all active bookings
    const bookings = await Booking.find({
      user: _id,
      isBookingActive: true,
      status: { $in: ["Pending", "Processing"], $nin: ["Rated", "Cancelled"] },
    }).populate("user");
    let updatedStatus = bookings.status;
    let updatedIsBookingActive = bookings.isBookingActive;
    let updatedBooking;
    // Update booking statuses
    const updatedBookings = await Promise.all(
      bookings.map(async (booking) => {
        if (
          booking.startTime.isBefore(updatedTime) &&
          updatedTime.isBefore(booking.endTime)
        )
        
        {
          if(booking.status==="Cancelled"){
            updatedStatus = "Cancelled";
          }else{
          updatedStatus = "Processing";
          }
        } else if (updatedTime.isAfter(bookings.endTime)) {
          if (booking.status === "Cancelled") {
            updatedStatus = "Cancelled";
          } else {
            updatedStatus = "Completed";
          }
          updatedIsBookingActive = false;
        }
        try {
          // await booking.save();
          updatedBooking = await Booking.findByIdAndUpdate(booking._id, {
            status: updatedStatus,
            isBookingActive: updatedIsBookingActive,
          });
        } catch (error) {
          console.log("booking save nahi ho rahi hai", error);
        }
        return updatedBooking;
      })
    );

    if (next) {
      next();
    } else {
      res.json({
        message: "Booking status updated successfully",
        updatedBookings,
      });
    }
  } catch (error) {
    console.error("Error updating booking status:", error);
    if (next) {
      next(error);
    } else {
      res.status(500).json({ message: "Failed to update booking status" });
    }
  }
};

const updatebookingstatus = async (req, res) => {
  const { status } = req.body;

  const bookingId = req.params.id;

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return res.status(400).json({ message: "Booking not found !!!" });
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
    bookingId,
    { $set: { status } },
    { new: true }
  );
  return res.status(200).json({ updatedBooking });
};
// rating a booking after completion of booking by user if status is Completed
// const rateBooking = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   validateMongoDbId(id);
//   try {
//     const booking = await Booking.findById(id)
//       .populate("user")
//       .populate("podId")
//       .exec();
//       console.log("booking", booking);
//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found" });
//     }
//     if (booking.status !== "Completed") {
//       return res
//         .status(400)
//         .json({ message: "Booking must be completed to rate it." });
//     } else if (booking.isBookingActive === false) {
//       return res.status(400).json({ message: "Booking is already rated." });
//     }

//     const product = booking.podId;

//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     const { rating, message } = req.body;
//     booking.feedback = {
//       rating,
//       message,
//     };

//     if (!product.ratings) {
//       product.ratings = [];
//     }

//     const newRating = {
//       star: rating,
//       comment: message,
//       postedby: booking.user._id,
//     };
//     product.ratings.push(newRating);

//     let totalRating = 0;
//     product.ratings.forEach((rating) => {
//       totalRating += rating.star;
//     });
//     product.ratingCount = product.ratings.length;
//     product.totalRating = totalRating / product.ratingCount;

//     // Notify the user about the rating
//     sendNotification(req, res);

//     booking.status = "Rated";
//     booking.isBookingActive = false;
//     await booking.save();
//     await product.save();

//     res.json({ message: "Successfully Rated" });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

// const rateBooking = async (req, res) => {
//   try {
//     const { rating, message } = req.body;
//     const bookingId = req.params.id;

//     console.log("Received rating request for booking ID:", bookingId);
//     console.log("Rating:", rating, "Message:", message);

//     const booking = await Booking.findById(bookingId);

//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found" });
//     }

//     if (booking.status !== "Completed") {
//       return res.status(400).json({ message: "Booking is not completed yet" });
//     }

//     booking.feedback = { rating, message };
//     booking.status = "Rated";

//     await booking.save();

//     res.status(200).json({ message: "Rating submitted successfully", booking });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };
const rateBooking = async (req, res) => {
  try {
    const { rating, message } = req.body;
    const bookingId = req.params.bookingId; // Assume the booking ID is passed in the URL
    const productId = req.params.productId; // Assume the product ID is also passed in the URL
    // const userId = req.user._id; // Assume user ID is available from authentication middleware

    console.log("Received rating request for booking ID:", bookingId);
    console.log("Rating:", rating, "Message:", message);

    // Find the booking by booking ID
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "Completed") {
      return res.status(400).json({ message: "Booking is not completed yet" });
    }

    // Save feedback in Booking
    // booking.feedback = { rating, message };
    // booking.status = "Rated";
    // await Booking.findByIdAndUpdate(
    //   bookingId,
    //   { status: "Rated", feedback: { rating, message } },
    //   { new: true }
    // );
 const updatedratedBooking= await Booking.findByIdAndUpdate(
      bookingId,
      { $set: { status: "Rated", feedback: { rating, message } } },
      { new: true }
    );

    // Find the corresponding product by product ID
    const product = await productModel.findById(productId);
console.log("product",product);
console.log("product.rate",product.ratings);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Add the rating to the product's ratings array
    product.ratings.push({
      star: rating,
      comment: message,
      // postedby: userId,
    });

    // Save the product with the updated ratings
    await product.save();

    // Send the response back with both booking and product
    res.status(200).json({
      message: "Rating submitted successfully for both booking and product",
      updatedratedBooking,
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// const getAllRatings = async (req, res) => {
//   try {
   

//     const ratedProducts = await productModel.find(
//       { "ratings.0": { $exists: true } },
//       { name: 1, ratings: 1 }
//     );

//     res.status(200).json({
//       message: "All ratings from bookings and products retrieved",
//       products: ratedProducts,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };





// const getAllRatings = async (req, res) => {
//   try {
//     // Fetch all the products with ratings, and populate the fields such as location and category
//     const ratedProducts = await productModel
//       .find(
//         { "ratings.0": { $exists: true } }, // only products with ratings
//         { ratings: 1, title: 1, location: 1, category: 1 } // retrieving specific fields
//       )
//       .populate("location", "name direction") // Assuming Location model has fields like name and direction
//       .populate("category", "name") // Assuming PCategory model has a 'name' field
//   .populate('ratings.postedby', 'name email')
//     res.status(200).json({
//       message: "All ratings from bookings and products retrieved",
//       products: ratedProducts,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };



// const getAllRatings = async (req, res) => {
//   try {
//     // Fetch all the products with ratings and populate user details (postedby)
//     const ratedProducts = await productModel
//       .find(
//         { "ratings.0": { $exists: true } }, // only products with ratings
//         { ratings: 1, title: 1, location: 1, category: 1 } // retrieve specific fields
//       )
//       .populate("location", "name direction") // Populate Location model
//       .populate("category", "name") // Populate PCategory model
//       .populate("ratings.postedby", "firstname email"); // Populate User details for the rating's postedby field

// console.log(ratedProducts);
//     res.status(200).json({
//       message: "All ratings from bookings and products retrieved",
//       products: ratedProducts,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };



// const getAllRatings = async (req, res) => {
//   try {
//     const ratedBookings = await Booking.find(
//       { status: "Rated", feedback: { $exists: true } },
//       { feedback: 1, _id: 1, userId: 1 }
//     );

//     const ratedProducts = await productModel.find(
//       { "ratings.0": { $exists: true } },
//       { name: 1, ratings: 1 }
//     );

//     res.status(200).json({
//       message: "All ratings from bookings and products retrieved",
//       bookings: ratedBookings,
//       products: ratedProducts,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const getAllRatings = async (req, res) => {
  try {
    const ratedBookings = await Booking.find(
      { status: "Rated", feedback: { $exists: true } },
      { feedback: 1, _id: 1, userId: 1, bookingDate: 1, startTime: 1, endTime:1 }
    ).populate("user", "firstname lastname email"); // Populate user details from userId in Booking

    const ratedProducts = await productModel
      .find(
        { "ratings.0": { $exists: true } },
        { name: 1, ratings: 1, location: 1, title: 1 }
      )
      .populate("location", "name direction"); // Populate location details from location in Product

    const result = {
      bookings: ratedBookings,
      products: ratedProducts,
    };

    res.status(200).json({
      message: "All ratings from bookings and products retrieved",
      result,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateBookingStatusByAdmin = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    res.json(updatedBooking);
  } catch (error) {
    throw new Error(error);
  }
});

const sendNotification = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const user = await User.findById(_id).exec();
    if (!user) throw new Error("User not found");

    const bookings = await Booking.find({ user: _id }).exec();

    for (const booking of bookings) {
      let emailContent = "";

      // If booking status has changed, send notification
      if (booking.status !== user.lastBookingStatus) {
        emailContent = `Hi ${user.firstname},\n\nYour booking with ID ${booking._id} has been updated to ${booking.status}.`;
        user.lastBookingStatus = booking.status; // Update user's last booking status
      }

      // If a new booking has been created, send booking details
      if (booking.status === "Pending" && !booking.isNotificationSent) {
        emailContent = `Hi ${user.firstname},\n\nThank you for choosing Privily! 
        You have successfully created a booking with us.
         Your booking details are as follows:\n\nStart Time: ${booking.startTime}\n
         End Time: ${booking.endTime}\nBooking Purpose: ${booking.bookingPurpose}`;
        booking.isNotificationSent = true; // Mark booking as notification sent
      }

      // If email content exists, send email
      if (emailContent) {
        const data = {
          to: user.email,
          subject: "Booking Notification",
          html: emailContent,
        };
        await sendEmail(data.to, data.subject, data.html); // Send email
        await booking.save(); // Save changes to booking
      }
    }

    await user.save(); // Save changes to user
    res.json({ message: "Notification sent successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error sending notification: " + error.message });
  }
});

const getAllNotification = asyncHandler(async (req, res) => {
  const user = req.user;
  await updateBookingStatusAutomatically(req, res, async () => {});
  const bookings = await Booking.find({
    user: user._id,
    status: "Completed",
  });
  result = { data: [] };
  bookings.forEach((booking) => {
    result["data"].push({
      message:
        "This is regarding your last booking on " +
        booking.bookingDate.toString(),
      booking_id: booking._id,
      podId: booking.podId,
      icon: "icon to send",
      type: "Rating", // as per this type, frontend will redirect to feedback mark page.
    });
  });
  res.json(result);
});

const webAuth = asyncHandler(async (req, res) => {
  const { email, phoneNumber, firstname, lastname } = req.body;
  if (!email && !phoneNumber) {
    return res.status(400).json({ message: "Email or phone number required" });
  }
  try {
    let user = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (!user) {
      user = await User.create({
        email: email || `${phoneNumber}@privily.co`,
        phoneNumber: phoneNumber || "",
        firstname: firstname || "Guest",
        lastname: lastname || "User",
        password: Math.random().toString(36).slice(-10),
        role: "user",
      });
    }
    const token = generateToken(user._id);
    res.json({ token, userId: user._id, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = {
  webAuth,
  createUser,
  deleteMyAccount,
  loginUserCtrl,
  loginMobileUserCtrl,
  verifyMobileOtp,
  verifyAuthPage,
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
  getAllRatings,
  // applyCoupon,
  createBooking,
  getBookings,
  cancelBooking,
  getBookingsByUser,
  getBookingById,
  updateBookingById,
  updateBookingStatusAutomatically,
  updateBookingStatusByAdmin,
  updatebookingstatus,
  setCurrentLocation,
  sendNotification,
  rateBooking,
  bookingFeedback,
  corporatePods,
  getAllNotification,
  getMe,
  extendBooking,
  verifyEmail,
  registerAndAssignRoles,
  getallstaff,
  blockStaff,
  unblockStaff,
  deleteStaff,
  editStaff,
  getUserByID
};


const yocoCheckout = asyncHandler(async (req, res) => {
  const { amountInCents, successUrl, cancelUrl } = req.body;
  const response = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY_LIVE}`,
    },
    body: JSON.stringify({ amount: amountInCents, currency: 'ZAR', successUrl, cancelUrl }),
  });
  const data = await response.json();
  if (!response.ok) return res.status(response.status).json(data);
  res.json(data);
});
module.exports.yocoCheckout = yocoCheckout;

// Mark a cancelled booking's quarter-hour slots free again on its pod/day.
// Shared by refund-booking; cancel-booking keeps its original inline copy.
const releaseBookingSlots = async (booking) => {
  const day = booking.bookingDate;
  const productAvailability = await ProductAvailability.findOne({
    product_id: booking.podId,
    booking_date: {
      $gte: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
      $lt: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
    },
  });
  if (!productAvailability) return;
  const slots = productAvailability.slot_bookings;
  const startingIndex = get_slot_index_from_time(booking.startTime, START_TIME);
  const endingIndex = get_slot_index_from_time(booking.endTime, START_TIME);
  for (let i = startingIndex; i < endingIndex; i++) slots[i] = false;
  await ProductAvailability.findOneAndUpdate(
    { _id: productAvailability._id },
    { slot_bookings: slots },
    { new: true }
  );
};

const refundBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { checkoutId, reference: bodyReference, gateway: bodyGateway } = req.body || {};
  validateMongoDbId(bookingId);

  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  // Prefer the Transaction linked to the booking; fall back to whatever
  // identifier the caller sent (older admin builds send a Yoco checkoutId).
  let txn = await Transaction.findOne({ booking: booking._id, status: { $ne: "refunded" } });
  const reference = bodyReference || checkoutId || booking.paymentReference || (txn && txn.reference);
  if (!txn && reference) {
    txn = await Transaction.findOne({ $or: [{ reference }, { checkoutId: reference }] });
  }
  if (!reference) {
    return res.status(400).json({ message: "No payment reference found for this booking" });
  }
  if (txn && txn.status === "refunded") {
    return res.status(409).json({ message: "This payment was already refunded" });
  }

  const gatewayName =
    payments.normalizeGatewayName(bodyGateway) ||
    (txn && txn.gateway) ||
    booking.paymentGateway ||
    "yoco";

  let refund;
  try {
    refund = await payments.getGateway(gatewayName).refund({ reference });
  } catch (error) {
    console.error(`Refund via ${gatewayName} failed:`, error.data || error.message);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ message: error.message || "Refund failed", error: error.data || null });
  }

  const now = new Date();
  if (txn) {
    txn.status = "refunded";
    txn.refundedAt = now;
    txn.refundId = refund.refundId ? String(refund.refundId) : txn.refundId;
    await txn.save();
  }

  // Same side effects as cancel-booking: free the pod's time slots and tell
  // the customer, so callers do not need a second cancel call afterwards.
  const wasActive = booking.status !== "Cancelled";
  booking.status = "Cancelled";
  booking.isBookingActive = false;
  await booking.save();
  if (wasActive) {
    try {
      await releaseBookingSlots(booking);
    } catch (e) {
      console.error("refund: slot release failed:", e.message);
    }
    sendNotificationOnCancel(booking.user, booking._id);
  }

  res.json({
    message: "Refund issued and booking cancelled",
    gateway: gatewayName,
    reference,
    refund: refund.raw || refund,
  });
});
module.exports.refundBooking = refundBooking;
