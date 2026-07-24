const jwt = require("jsonwebtoken");
const router = require("express").Router();
const upload = require("../middlewares/uploadMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const {
  sendKycEmailOtp,
  verifyKycEmailOtp,
  uploadKYC,
  getKYCStatus,
} = require("../apis/user/userController");
const { getRoutes } = require("../apis/route/routeController");
const tripController = require("../apis/trip/tripController");
const paymentController = require("../apis/payment/paymentController");
const ticketController = require("../apis/ticket/ticketController");
const { Trip } = require("../apis/trip/tripModel");
const LocationHistory = require("../apis/locationHistory/locationHistoryModel");

// const {
//   getBusiness,
//   getAllBusinesses,
// } = require("../apis/Business/businessController");
const {
  getVehicle,
  getVehicleGallery,
  getUserVehicles,
} = require("../apis/vehicle/vehicleController");
const bookingController = require("../apis/booking/bookingController");
const {
  createRideRequest,
  getRideRequests,
  getRideRequest,
} = require("../apis/rideRequest/rideRequestController");
const {
  getSeatLayout,
  getSeatAvailability,
  reserveSeat,
  releaseSeat,
  holdSeats,
  confirmHeldSeats,
  releaseHeldSeats,
} = require("../apis/seat/seatController");
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerFcmToken,
} = require("../apis/notifications/notificationController");

const sosController = require("../apis/sos/sosController");
const tripShareController = require("../apis/tripSharing/tripShareController");

// Optional authentication middleware
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      req.user = jwt.verify(authHeader, process.env.JWT_SECRET);
    } catch (err) {}
  }
  next();
};

// USER routes
router.post("/send-kyc-email-otp", authMiddleware, sendKycEmailOtp);
router.post("/verify-kyc-email-otp", authMiddleware, verifyKycEmailOtp);
router.post(
  "/upload-kyc",
  authMiddleware,
  roleMiddleware("customer", "driver", "owner"),
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "documentFront", maxCount: 1 },
    { name: "documentBack", maxCount: 1 },
  ]),
  uploadKYC,
);
router.post("/get-kyc-status", authMiddleware, getKYCStatus);

// ROUTE routes
router.post("/all-routes", authMiddleware, getRoutes);

// TRIP routes
router.get("/trip-categories", tripController.getCategories);
router.post("/active-trips", optionalAuth, tripController.getActiveTrips);
router.post("/trip-details", optionalAuth, tripController.getTripById);
router.post("/my-trips", authMiddleware, tripController.getUserTrips);
router.post("/get-user-trips", authMiddleware, tripController.getOwnerTrips);

// SEAT routes
router.post("/seat-layout", authMiddleware, getSeatLayout);
router.post("/seat-availability", optionalAuth, getSeatAvailability);
// router.post("/reserve-seat", authMiddleware, reserveSeat);
// router.post("/release-seat", authMiddleware, releaseSeat);
router.post("/hold-seat", authMiddleware, holdSeats);
router.post("/confirm-seat", authMiddleware, confirmHeldSeats);
router.post("/release-seat", authMiddleware, releaseHeldSeats);

// BUSINESS / OWNERSHIP routes — COMMENTED OUT
// router.post("/get-business", authMiddleware, getBusiness);
// router.post("/get-all-businesses", authMiddleware, getAllBusinesses);

// VEHICLE routes
router.post("/get-vehicle", authMiddleware, getVehicle);
router.post("/get-vehicle-gallery", authMiddleware, getVehicleGallery);
router.post("/get-user-vehicles", authMiddleware, getUserVehicles);

// BOOKING routes
router.post("/create-booking", authMiddleware, bookingController.createBooking);
router.post("/cancel-booking", authMiddleware, bookingController.cancelBooking);
router.post("/get-booking", authMiddleware, bookingController.getBooking);
router.post("/my-bookings", authMiddleware, bookingController.getUserBookings);

// PAYMENT routes
router.post(
  "/payment/create-order",
  authMiddleware,
  paymentController.createPaymentOrder,
);
router.post(
  "/payment/verify-razorpay",
  authMiddleware,
  paymentController.verifyRazorpayPayment,
);
router.post(
  "/payment/upload-proof",
  authMiddleware,
  upload.single("screenshot"),
  paymentController.uploadPaymentProof,
);

// TICKET routes
router.post(
  "/generate-ticket",
  authMiddleware,
  ticketController.generateTicket,
);
router.post(
  "/download-ticket",
  authMiddleware,
  ticketController.downloadTicket,
);
router.post("/get-ticket", authMiddleware, ticketController.getTicket);
router.post("/my-tickets", authMiddleware, ticketController.getUserTickets);

// RIDE REQUEST routes
router.post("/create-ride-request", authMiddleware, createRideRequest);
router.post("/get-ride-request", authMiddleware, getRideRequest);

// SOS routes
router.post("/triggerSOS", sosController.triggerSOS);
router.post("/shareLiveLocation", sosController.shareLiveLocation);
router.post("/closeSOS/:alertId", sosController.closeSOS);

// Live Tracking
router.get("/trips/:tripId/history", authMiddleware, async (req, res, next) => {
  try {
    const history = await LocationHistory.find({ tripId: req.params.tripId })
      .sort({ createdAt: 1 })
      .select("location speed heading createdAt");

    res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    next(err);
  }
});

// Trip ki latest location (Socket na ho toh fallback)
router.get(
  "/trips/:tripId/location",
  authMiddleware,
  async (req, res, next) => {
    try {
      const trip = await Trip.findById(req.params.tripId).select(
        "currentLocation status",
      );

      if (!trip)
        return res
          .status(404)
          .json({ success: false, message: "Trip not found" });

      res.json({ success: true, data: trip });
    } catch (err) {
      next(err);
    }
  },
);
// TRIP SHARE routes
router.post(
  "/trip/share/generate",
  authMiddleware,
  tripShareController.generateShareLink,
);
router.post("/trip/share/track", tripShareController.trackLinkClick);

// NOTIFICATION routes
router.post("/notifications", authMiddleware, getUserNotifications);
router.post("/notifications/read", authMiddleware, markAsRead);
router.post("/notifications/read-all", authMiddleware, markAllAsRead);
router.post("/notifications/register-token", authMiddleware, registerFcmToken);

module.exports = router;
