const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const tripController = require("../apis/trip/tripController");
const {
  sendKycEmailOtp,
  verifyKycEmailOtp,
  uploadKYC,
  getKYCStatus,
} = require("../apis/user/userController");
const {
  createVehicle,
  updateVehicle,
  getUserVehicles,
} = require("../apis/vehicle/vehicleController");
const ticketController = require("../apis/ticket/ticketController");
const {
  submitSafetyCheck,
} = require("../apis/safetyCheck/safetyCheckController");
const { createSeatLayout, getSeatLayout } = require("../apis/seat/seatController");
const {
  assignVehicleToDriver,
  removeVehicleAssignment,
} = require("../apis/driverAssignment/driverAssignController");
const { registerDriver, updateDriver, getDriverById, getDriversByOwner, getAssignedVehicles } = require("../apis/driver/driverController");

// Protect all driver routes
router.use(authMiddleware);
router.use(roleMiddleware("driver", "owner"));

// TRIP routes
router.post(
  "/create-trip",
  upload.single("tripBanner"),
  tripController.createTrip,
);
router.post("/submit-for-approval", tripController.submitForApproval);
router.post("/start-trip", tripController.startTrip);
router.post("/end-trip", tripController.endTrip);
router.post("/cancel-trip", tripController.cancelTrip);
// ===== CHANGED: added getDriverTrips endpoint for driver's own assigned trips =====
router.post("/get-driver-trips", tripController.getDriverTrips);

// KYC
router.post("/send-kyc-email-otp", sendKycEmailOtp);
router.post("/verify-kyc-email-otp", verifyKycEmailOtp);
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

// VEHICLE routes
router.post(
  "/add-vehicle",
  upload.fields([
    { name: "rc_document", maxCount: 1 },
    { name: "insurance_document", maxCount: 1 },
    { name: "vehicle_photos", maxCount: 5 },
  ]),
  createVehicle,
);
router.post(
  "/update-vehicle",
  upload.fields([
    { name: "rc_document", maxCount: 1 },
    { name: "insurance_document", maxCount: 1 },
    { name: "vehicle_photos", maxCount: 5 },
  ]),
  updateVehicle,
);

// SEAT routes
router.post("/create-seat-layout", createSeatLayout);
router.post("/get-seat-layout", getSeatLayout);

// TICKET routes
router.post("/validate-ticket", ticketController.validateTicket);

// SAFETY CHECKLIST routes
router.post("/submit-safety-check", submitSafetyCheck);

// DRIVER routes
router.post(
  "/register-driver",
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "documentFront", maxCount: 1 },
    { name: "documentBack", maxCount: 1 },
  ]),
  registerDriver,
);
router.post(
  "/update-driver",
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "documentFront", maxCount: 1 },
    { name: "documentBack", maxCount: 1 },
  ]),
  updateDriver,
);
router.post("/get-driver", getDriverById);
router.post("/get-owner-drivers", getDriversByOwner);
router.post("/get-assigned-vehicles", getAssignedVehicles);


// DRIVER ASSIGNMENT routes
router.post("/assign-vehicle", assignVehicleToDriver);
router.post("/remove-assignment", removeVehicleAssignment);

module.exports = router;
