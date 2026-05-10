const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Booking = require("../models/bookingModel");
const Transaction = require("../models/Transaction");
const productModel = require("../models/productModel");
const locationModel = require("../models/locationModel");
const registerstaff = require("../models/registerstaff");

// GET /api/admin/stats
const getAdminStats = asyncHandler(async (req, res) => {
  try {
    const [
      totalUsers,
      totalBookings,
      totalPods,
      totalLocations,
      totalStaff,
      totalTransactions,
      bookingsByStatus,
      recentBookings,
      recentTransactions,
      monthlyRevenue,
      locations,
    ] = await Promise.all([
      User.countDocuments(),
      Booking.countDocuments(),
      productModel.countDocuments(),
      locationModel.countDocuments(),
      registerstaff.countDocuments(),
      Transaction.countDocuments(),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "firstname lastname email")
        .populate("podId", "title"),
      Transaction.find().sort({ createdAt: -1 }).limit(10),
      Transaction.aggregate([
        { $match: { status: { $in: ["successful", "success", "SUCCESSFUL", "completed"] } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
      locationModel.find({}, "_id name city"),
    ]);

    const revenueResult = await Transaction.aggregate([
      { $match: { status: { $in: ["successful", "success", "SUCCESSFUL", "completed"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const statusCounts = { Pending: 0, Confirmed: 0, Cancelled: 0, Processing: 0, Completed: 0, Rated: 0 };
    bookingsByStatus.forEach((s) => {
      if (Object.prototype.hasOwnProperty.call(statusCounts, s._id)) {
        statusCounts[s._id] = s.count;
      }
    });

    res.json({
      overview: { totalUsers, totalBookings, totalPods, totalLocations, totalStaff, totalTransactions, totalRevenue },
      bookingsByStatus: statusCounts,
      monthlyRevenue,
      recentBookings,
      recentTransactions,
      locations,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

// GET /api/admin/bookings?status=&page=&limit=&search=&startDate=&endDate=&locationId=
const getAllBookingsAdmin = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, startDate, endDate, locationId } = req.query;

    // Build base filter
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (startDate || endDate) {
      filter.bookingDate = {};
      if (startDate) filter.bookingDate.$gte = new Date(startDate);
      if (endDate) filter.bookingDate.$lte = new Date(endDate);
    }

    // Location filter: first find pods at that location
    if (locationId && locationId !== "all") {
      const podsAtLocation = await productModel.find({ location: locationId }, "_id");
      const podIds = podsAtLocation.map((p) => p._id);
      filter.podId = { $in: podIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Booking.countDocuments(filter);

    let bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "firstname lastname email phoneNumber")
      .populate({
        path: "podId",
        select: "title location deviceId serial UserId email",
        populate: { path: "location", select: "name city" },
      });

    // Search filter (by user name, pod title, booking ID)
    if (search) {
      const s = search.toLowerCase();
      bookings = bookings.filter((b) => {
        const name = b.user ? `${b.user.firstname} ${b.user.lastname}`.toLowerCase() : "";
        return (
          name.includes(s) ||
          b.podTitle?.toLowerCase().includes(s) ||
          b._id.toString().includes(s) ||
          b.podId?.location?.name?.toLowerCase().includes(s)
        );
      });
    }

    // For each booking, find its matching transaction (closest by time after booking)
    const bookingsWithTransaction = await Promise.all(
      bookings.map(async (b) => {
        const bookingObj = b.toObject();
        const txn = await Transaction.findOne({
          createdAt: {
            $gte: new Date(b.createdAt.getTime() - 10 * 60 * 1000),
            $lte: new Date(b.createdAt.getTime() + 10 * 60 * 1000),
          },
        }).sort({ createdAt: 1 });
        return { ...bookingObj, transaction: txn || null };
      })
    );

    res.json({
      data: bookingsWithTransaction,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

// GET /api/admin/booking/:id — single booking with transaction + pod ratings
const getBookingDetail = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate("user", "firstname lastname email phoneNumber address")
      .populate({
        path: "podId",
        select: "title location deviceId serial UserId email rate ratings images",
        populate: [
          { path: "location", select: "name city Street" },
          { path: "ratings.postedby", model: "User", select: "firstname lastname" },
        ],
      });

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Find matching transaction (within 10 min of booking creation)
    const transaction = await Transaction.findOne({
      createdAt: {
        $gte: new Date(booking.createdAt.getTime() - 10 * 60 * 1000),
        $lte: new Date(booking.createdAt.getTime() + 10 * 60 * 1000),
      },
    }).sort({ createdAt: 1 });

    res.json({ booking, transaction: transaction || null });
  } catch (error) {
    console.error("Error fetching booking detail:", error);
    res.status(500).json({ message: "Failed to fetch booking detail" });
  }
});

// GET /api/admin/users?page=&limit=&search=&isBlocked=
const getAllUsersAdmin = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isBlocked } = req.query;
    const filter = {};
    if (isBlocked !== undefined && isBlocked !== "all") filter.isBlocked = isBlocked === "true";
    if (search) {
      filter.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-password -passwordResetToken -passwordResetExpires")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("booking", "status bookingDate podTitle");

    res.json({
      data: users,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET /api/admin/transactions?page=&limit=&status=
const getAllTransactionsAdmin = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// GET /api/admin/ratings — all ratings across all products with timestamps
const getAllRatingsAdmin = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, locationId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const productFilter = {};
    if (locationId && locationId !== "all") productFilter.location = locationId;

    const products = await productModel
      .find(productFilter)
      .select("title ratings location deviceId serial")
      .populate("location", "name city")
      .populate("ratings.postedby", "firstname lastname email");

    // Flatten ratings from all products
    const allRatings = [];
    for (const product of products) {
      for (const rating of product.ratings) {
        allRatings.push({
          _id: rating._id,
          productId: product._id,
          productTitle: product.title,
          location: product.location,
          star: rating.star,
          comment: rating.comment,
          createdAt: rating.createdAt,
          user: rating.postedby
            ? { _id: rating.postedby._id, name: `${rating.postedby.firstname} ${rating.postedby.lastname}`, email: rating.postedby.email }
            : null,
        });
      }
    }

    // Sort by newest first
    allRatings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allRatings.length;
    const paginated = allRatings.slice(skip, skip + parseInt(limit));

    res.json({
      data: paginated,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ message: "Failed to fetch ratings" });
  }
});

// GET /api/admin/locations — all locations for filters
const getLocationsAdmin = asyncHandler(async (req, res) => {
  try {
    const locations = await locationModel.find({}, "_id name city isBlocked");
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch locations" });
  }
});

module.exports = {
  getAdminStats,
  getAllBookingsAdmin,
  getBookingDetail,
  getAllUsersAdmin,
  getAllTransactionsAdmin,
  getAllRatingsAdmin,
  getLocationsAdmin,
};
