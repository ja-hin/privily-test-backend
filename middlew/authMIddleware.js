const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");

const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isBlocked) {
        return res.status(403).json({ message: "User is blocked" });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token expired or invalid, please login again" });
    }
  } else {
    return res.status(401).json({ message: "No token attached to header" });
  }
});

const isAdmin = asyncHandler(async (req, res, next) => {
  const { email } = req.user;
  const adminUser = await User.findOne({ email });
  if (!adminUser || adminUser.role !== "admin") {
    return res.status(403).json({ message: "You are not an Admin" });
  }
  next();
});

module.exports = { authMiddleware, isAdmin };
