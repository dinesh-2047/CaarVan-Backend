const { Trip, CATEGORY_NAMES } = require("./tripModel");
const Route = require("../route/routeModel");
const User = require("../user/userModel");
const Vehicle = require("../vehicle/vehicleModel");
const { Booking } = require("../booking/bookingModel");
const notify = require("../../utils/notify");

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

exports.getCategories = (req, res) => {
  const categories = CATEGORY_NAMES.map((name) => ({
    name,
    isLadiesOnly: name === "Ladies Only",
  }));

  res.status(200).json({
    sucess: true,
    count: categories.length,
    categories,
  });
};

// create trip
exports.createTrip = async (req, res, next) => {
  try {
    // ===== CHANGED: destructure checkpoints from req.body =====
    let {
      routeId,
      vehicleId,
      driverId,
      category,
      departureTime,
      arrivalTime,
      seatCapacity,
      fare,
      checkpoints: selectedCheckpoints,
    } = req.body;

    // required fields
    if (
      !routeId ||
      !vehicleId ||
      !driverId ||
      !departureTime ||
      !arrivalTime ||
      !seatCapacity ||
      !fare ||
      !category
    ) {
      return next(
        createError(
          "routeId, vehicleId, driverId, category, departureTime, arrivalTime, seatCapacity, and fare are required",
        ),
      );
    }

    let parsedCategory = category;
    if (typeof category === "string") {
      try {
        parsedCategory = JSON.parse(category);
      } catch {
        return next(
          createError(
            "Category must be a valid JSON object with name and colorCode",
          ),
        );
      }
    }

    // Verify route exists
    const routeExists = await Route.findById(routeId);
    if (!routeExists) {
      return next(createError("Route not found", 404));
    }

    // ===== CHANGED: resolve + validate selected checkpoints from route =====
    // FIX: driver panel may send a single JSON object or a JSON string instead of an array
    let tripCheckpoints = [];
    if (selectedCheckpoints) {
      let parsed = selectedCheckpoints;
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch { parsed = null; }
      }
      let cpArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      if (cpArray.length > 0) {
        const routeCheckpointCities = routeExists.checkpoints.map((cp) => cp.city);
        const invalid = cpArray.filter(
          (cp) => !routeCheckpointCities.includes(cp.city),
        );
        if (invalid.length > 0) {
          return next(
            createError(
              `Invalid checkpoint(s): ${invalid.map((c) => c.city).join(", ")}. Must be one of: ${routeCheckpointCities.join(", ")}`,
            ),
          );
        }
        tripCheckpoints = cpArray.map((cp, idx) => {
          const match = routeExists.checkpoints.find((r) => r.city === cp.city);
          return {
            city: cp.city,
            arrival_time: cp.arrival_time || (match ? match.arrival_time : undefined),
            order: cp.order || idx + 1,
          };
        });
      }
    }

    // Verify driver exists and has role 'driver'
    const driverUser = await User.findById(driverId);
    if (!driverUser) {
      return next(createError("Driver not found", 404));
    }
    if (driverUser.role !== "driver" && driverUser.role !== "owner") {
      return next(createError("Assigned user is not a driver or owner", 400));
    }

    // ===== CHANGED: block new trip if driver already has an active one =====
    const activeStatuses = ["PENDING", "APPROVED", "STARTED", "ACTIVE"];
    const existingActive = await Trip.findOne({
      driverId,
      status: { $in: activeStatuses },
    });
    if (existingActive) {
      return next(
        createError(
          `Driver already has an active trip (${existingActive.tripCode || existingActive._id}) in status "${existingActive.status}". Complete or cancel it before creating a new one.`,
          409,
        ),
      );
    }

    // ladies only - female driver
    if (parsedCategory.name === "Ladies Only") {
      if (req.user.role === "driver") {
        const creatorUser = await User.findById(req.user.id);
        if (!creatorUser || creatorUser.gender !== "female") {
          return next(
            createError(
              "Only female drivers can create a Ladies Only trip",
              403,
            ),
          );
        }
      }
      if (driverUser.gender !== "female") {
        return next(
          createError(
            "The assigned driver must be female for a Ladies Only trip",
            400,
          ),
        );
      }
    }

    let status = "PENDING";
    let approvalStatus = "PENDING";
    let submitForApproval = false;
    let approvedBy = undefined;
    let approvedAt = undefined;

    if (req.user.role === "admin") {
      status = "APPROVED";
      approvalStatus = "APPROVED";
      submitForApproval = true;
      approvedBy = req.user.id;
      approvedAt = new Date();
    }

    // ===== CHANGED: added checkpoints to tripData =====
    const tripData = {
      routeId,
      vehicleId,
      driverId,
      category: parsedCategory,
      departureTime,
      arrivalTime,
      seatCapacity,
      fare,
      createdBy: req.user.id,
      status,
      approvalStatus,
      submitForApproval,
      approvedBy,
      approvedAt,
      checkpoints: tripCheckpoints,
    };

    if (req.file) {
      tripData.tripBanner = req.file.path;
    }

    const trip = await Trip.create(tripData);

    await trip.populate([
      {
        path: "routeId",
        select:
          "route_code source destination checkpoints distance estimated_duration",
      },
      { path: "driverId", select: "name profilePicture phone" },
      { path: "vehicleId", select: "vehicle_number seat_capacity" },
      { path: "createdBy", select: "name role" },
    ]);

    res
      .status(201)
      .json({ success: true, message: "Trip created suceessfully", trip });
  } catch (error) {
    next(error);
  }
};

// submit for approval
exports.submitForApproval = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) return next(createError("TripId is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    if (trip.status !== "PENDING") {
      return next(
        createError(`Cannot submit a trip that is already ${trip.status}`),
      );
    }

    const isOwner = trip.createdBy.toString() === req.user.id;

    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

    if (!isOwner && !isAdminOrManager)
      return next(createError("Forbidden", 403));

    trip.submitForApproval = true;
    trip.submittedAt = new Date();
    await trip.save();

    res
      .status(200)
      .json({ success: true, message: "Trip submitted for approval", trip });
  } catch (error) {
    next(error);
  }
};

// approve trip
exports.approveTrip = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    if (!trip.submitForApproval) {
      return next(createError("Trip has not been submitted for approval yet"));
    }

    if (trip.approvalStatus !== "PENDING") {
      return next(createError(`Trip is already ${trip.approvalStatus}`));
    }

    trip.approvalStatus = "APPROVED";
    trip.status = "APPROVED";
    trip.approvedBy = req.user.id;
    trip.approvedAt = new Date();
    await trip.save();

    // Notify driver about trip approval
    await notify({
      userId: trip.driverId,
      title: "Trip Approved",
      message: `Your trip ${trip.tripCode} has been approved by admin. You can start the trip at the scheduled departure time.`,
      type: "SUCCESS",
      metadata: { tripId: trip._id.toString(), tripCode: trip.tripCode },
    });

    res.status(200).json({ success: true, message: "Trip is approved", trip });
  } catch (error) {
    next(error);
  }
};

// reject trip
exports.rejectTrip = async (req, res, next) => {
  try {
    const { tripId, reason } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    if (!reason) return next(createError("Rejection reason is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    if (trip.approvalStatus !== "PENDING") {
      return next(createError(`Trip is already ${trip.approvalStatus}`));
    }

    trip.approvalStatus = "REJECTED";
    trip.status = "REJECTED";
    trip.rejectionReason = reason;
    trip.approvedBy = req.user.id;
    trip.approvedAt = new Date();
    await trip.save();

    res.status(200).json({ success: true, message: "Trip rejected", trip });
  } catch (error) {
    next(error);
  }
};

// start trip
exports.startTrip = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    if (trip.status !== "APPROVED") {
      return next(createError("Only approved trips can be started"));
    }

    if (
      req.user.role === "driver" &&
      trip.driverId.toString() !== req.user.id
    ) {
      return next(
        createError("Forbidden - you are not the driver of the trip", 403),
      );
    }

    trip.status = "STARTED";
    trip.startedAt = new Date();
    await trip.save();

    res.status(200).json({ success: true, message: "Trip started", trip });
  } catch (error) {
    next(error);
  }
};

// end trip
exports.endTrip = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    if (trip.status !== "STARTED") {
      return next(createError("Only started trips can be ended"));
    }

    if (
      req.user.role === "driver" &&
      trip.driverId.toString() !== req.user.id
    ) {
      return next(createError("Forbidden", 403));
    }

    trip.status = "COMPLETED";
    trip.endedAt = new Date();
    await trip.save();

    res.status(200).json({ success: true, message: "Trip completed", trip });
  } catch (error) {
    next(error);
  }
};

// cancel trip
exports.cancelTrip = async (req, res, next) => {
  try {
    const { tripId, reason } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    if (!reason) return next(createError("Cancellation reason is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    const cancellableStatuses = ["PENDING", "APPROVED", "ACTIVE"];

    if (!cancellableStatuses.includes(trip.status)) {
      return next(createError(`Cannot cancel a trip that is ${trip.status}`));
    }

    const isOwner = trip.createdBy.toString() === req.user.id;

    const isDriver = trip.driverId.toString() === req.user.id;

    const isAdminOrManager = ["admin", "manager"].includes(req.user.role);

    if (!isOwner && !isDriver && !isAdminOrManager)
      return next(createError("Forbidden", 403));

    trip.status = "CANCELLED";
    trip.cancellationReason = reason;
    trip.cancelledBy = req.user.id;
    trip.cancelledAt = new Date();
    await trip.save();

    // 1. Notify booked passengers
    const bookings = await Booking.find({
      tripId: trip._id,
      bookingStatus: { $in: ["PENDING", "CONFIRMED"] },
    });
    for (const booking of bookings) {
      await notify({
        userId: booking.userId,
        title: "Trip Cancelled",
        message: `The trip ${trip.tripCode} you booked seats on has been cancelled by the driver/admin. Reason: ${reason}. A refund will be initiated if payment was completed.`,
        type: "DANGER",
        metadata: { tripId: trip._id.toString(), tripCode: trip.tripCode },
      });
    }

    // 2. Notify driver (if cancelled by admin)
    if (trip.driverId.toString() !== req.user.id) {
      await notify({
        userId: trip.driverId,
        title: "Trip Cancelled by Admin",
        message: `Your trip ${trip.tripCode} was cancelled by admin. Reason: ${reason}`,
        type: "WARNING",
        metadata: { tripId: trip._id.toString(), tripCode: trip.tripCode },
      });
    }

    res.status(200).json({ success: true, message: "Trip cancelled", trip });
  } catch (error) {
    next(error);
  }
};

// close trip
exports.closeTrip = async (req, res, next) => {
  try {
    const { tripId, reason } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    if (!reason) return next(createError("Trip closing reason is required"));

    const trip = await Trip.findById(tripId);

    if (!trip) return next(createError("Trip not found", 404));

    const terminalStatuses = ["COMPLETED", "CANCELLED"];

    if (terminalStatuses.includes(trip.status)) {
      return next(
        createError(`Trip is already ${trip.status} and cannot be closed`),
      );
    }

    trip.status = "CANCELLED";
    trip.cancelledAt = new Date();
    trip.cancelledBy = req.user.id;
    trip.cancellationReason = reason || "Closed by admin";
    await trip.save();

    // 1. Notify booked passengers
    const bookings = await Booking.find({
      tripId: trip._id,
      bookingStatus: { $in: ["PENDING", "CONFIRMED"] },
    });
    for (const booking of bookings) {
      await notify({
        userId: booking.userId,
        title: "Trip Force Closed",
        message: `The trip ${trip.tripCode} you booked seats on has been closed by admin. Reason: ${reason || "Closed by admin"}. A refund will be initiated.`,
        type: "DANGER",
        metadata: { tripId: trip._id.toString(), tripCode: trip.tripCode },
      });
    }

    // 2. Notify driver
    if (trip.driverId.toString() !== req.user.id) {
      await notify({
        userId: trip.driverId,
        title: "Trip Closed by Admin",
        message: `Your trip ${trip.tripCode} was closed by admin. Reason: ${reason || "Closed by admin"}`,
        type: "WARNING",
        metadata: { tripId: trip._id.toString(), tripCode: trip.tripCode },
      });
    }

    res.status(200).json({ success: true, message: "Trip closed", trip });
  } catch (error) {
    next(error);
  }
};

// getting active trips
exports.getActiveTrips = async (req, res, next) => {
  try {
    const { category, ladiesOnly } = req.body;

    const filter = {
      status: { $in: ["APPROVED", "STARTED"] },
      availableSeats: { $gt: 0 },
      departureTime: { $gte: new Date() },
    };

    if (category) filter["category.name"] = category;

    if (req.user) {
      if (ladiesOnly === true || ladiesOnly === "true") {
        if (req.user.gender !== "female") {
          return next(
            createError(
              "Ladies Only trips are restricted to female passengers",
              403,
            ),
          );
        }
        filter.isLadiesOnly = true;
      } else if (req.user.gender === "male") {
        filter.isLadiesOnly = { $ne: true };
      }
    } else {
      filter.isLadiesOnly = { $ne: true };
    }

    const trips = await Trip.find(filter)
      .populate(
        "routeId",
        "route_code source destination distance estimated_duration",
      )
      .populate("driverId", "name profilePicture")
      .populate("vehicleId", "vehicle_number seat_capacity")
      .sort({ departureTime: 1 });

    res.status(200).json({ success: true, count: trips.length, trips });
  } catch (error) {
    next(error);
  }
};

// get trip by id
exports.getTripById = async (req, res, next) => {
  try {
    const { tripId } = req.body;

    if (!tripId) return next(createError("tripId is required"));

    const trip = await Trip.findById(tripId)
      .populate("routeId")
      .populate("driverId", "name profilePicture phone")
      .populate("vehicleId")
      .populate("createdBy", "name role")
      .populate("approvedBy", "name role");

    if (!trip) return next(createError("Trip not found", 404));

    if (trip.isLadiesOnly && req.user && req.user.gender === "male") {
      return next(createError("Access denied", 403));
    }

    res.status(200).json({ success: true, trip });
  } catch (error) {
    next(error);
  }
};

// get user's trips
exports.getUserTrips = async (req, res, next) => {
  try {
    const { status } = req.body;

    const bookings = await Booking.find({ userId: req.user.id });

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        trips: [],
      });
    }

    const tripIds = [...new Set(bookings.map((b) => b.tripId.toString()))];

    const filter = { _id: { $in: tripIds } };

    if (status) {
      filter.status = status;
    }

    const trips = await Trip.find(filter)
      .populate(
        "routeId",
        "route_code source destination checkpoints distance estimated_duration",
      )
      .populate("driverId", "name profilePicture phone")
      .populate("vehicleId", "vehicle_number seat_capacity")
      .sort({ departureTime: -1 });

    res.status(200).json({
      success: true,
      count: trips.length,
      trips,
    });
  } catch (error) {
    next(error);
  }
};

// ===== FIXED: getOwnerTrips now also includes trips on the owner's vehicles =====
// Previously queried only { createdBy: userId }, so trips created by a driver
// (where createdBy = driver's ID) were invisible to the owner. Now also finds
// all vehicles owned by this user and includes trips on those vehicles via $or.
exports.getOwnerTrips = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) return next(createError("userId is required"));

    const ownerVehicles = await Vehicle.find({ user_id: userId }).select("_id");
    const ownerVehicleIds = ownerVehicles.map((v) => v._id);

    const filter = {
      $or: [
        { createdBy: userId },
        { vehicleId: { $in: ownerVehicleIds } },
      ],
    };

    const trips = await Trip.find(filter)
      .populate(
        "routeId",
        "route_code source destination checkpoints distance estimated_duration",
      )
      .populate("driverId", "name profilePicture phone")
      .populate("vehicleId", "vehicle_number vehicle_type seat_capacity")
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: trips.length,
      trips,
    });
  } catch (error) {
    next(error);
  }
};

// ===== NEW: getDriverTrips — lets a driver see all trips assigned to them =====
// Drivers had no endpoint to fetch trips where they are the driverId. Created
// trips have createdBy = the person who created them (could be owner), so the
// driver couldn't see owner-created trips. This queries by driverId directly.
exports.getDriverTrips = async (req, res, next) => {
  try {
    const filter = { driverId: req.user.id };

    const trips = await Trip.find(filter)
      .populate(
        "routeId",
        "route_code source destination checkpoints distance estimated_duration",
      )
      .populate("vehicleId", "vehicle_number vehicle_type seat_capacity")
      .populate("createdBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: trips.length,
      trips,
    });
  } catch (error) {
    next(error);
  }
};
