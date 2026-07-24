const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const tripController = require("../apis/trip/tripController");
const {
  createRoute,
  updateRoute,
  deleteRoute,
  getRoutes,
} = require("../apis/route/routeController");
const { approveKYC, rejectKYC } = require("../apis/user/userController");
// const {
//   approveBusiness,
//   rejectBusiness,
// } = require("../apis/Business/businessController");
const { verifyVehicle } = require("../apis/vehicle/vehicleController");
const paymentController = require("../apis/payment/paymentController");
const ticketController = require("../apis/ticket/ticketController");
const {
  convertRequestToTrip,
  getRideRequests,
} = require("../apis/rideRequest/rideRequestController");
const { getSafetyCheck } = require("../apis/safetyCheck/safetyCheckController");
const { createSeatLayout, getSeatLayout, expireHeldSeatsHandler } = require("../apis/seat/seatController");
const { getAllDrivers, getDriversByOwner } = require("../apis/driver/driverController");

// Protect all admin/manager routes
router.use(authMiddleware);
router.use(roleMiddleware("admin", "manager"));

// User KYC approve - reject
router.post("/approve-kyc", approveKYC);
router.post("/reject-kyc", rejectKYC);

// ROUTE routes
router.post("/create-route", createRoute);
router.post("/update-route", updateRoute);
router.post("/delete-route", deleteRoute);

// TRIP routes
router.post(
  "/create-trip",
  upload.single("tripBanner"),
  tripController.createTrip,
);
router.post("/approve-trip", tripController.approveTrip);
router.post("/reject-trip", tripController.rejectTrip);
router.post("/close-trip", tripController.closeTrip);

// BUSINESS / OWNERSHIP routes — COMMENTED OUT
// router.post("/approve-business", approveBusiness);
// router.post("/reject-business", rejectBusiness);

// VEHICLE routes
router.post("/verify-vehicle", verifyVehicle);

// PAYMENT routes
router.post("/verify-payment", paymentController.verifyPayment);
router.post("/reject-payment", paymentController.rejectPayment);
router.post("/refund-payment", paymentController.refundPayment);

// TICKET routes
router.post("/validate-ticket", ticketController.validateTicket);

// RIDE REQUEST routes
router.post("/get-all-rides", getRideRequests);
router.post("/ride-to-trip", convertRequestToTrip);

// SAFETY CHECKLIST routes
router.post("/get-safety-check", getSafetyCheck);

// SEAT routes
router.post("/create-seat-layout", createSeatLayout);
router.post("/get-seat-layout", getSeatLayout);
router.post("/expire-stale-holds", expireHeldSeatsHandler)

// DRIVER routes
router.post("/get-all-drivers", getAllDrivers);
router.post("/get-owner-drivers", getDriversByOwner);
module.exports = router;
