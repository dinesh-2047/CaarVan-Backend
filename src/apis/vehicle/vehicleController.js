const Vehicle = require("./vehicleModel");
const User = require("../user/userModel");
const APIFeatures = require("../../utils/apiTourFeatures");

// to create vehicle
const createVehicle = async (req, res, next) => {
  try {
    const { user_id, vehicle_number, vehicle_type, seat_capacity } =
      req.body;

    const existingVehicle = await Vehicle.findOne({
      vehicle_number: vehicle_number.toUpperCase(),
    });
    if (existingVehicle) {
      return res
        .status(409)
        .json({ message: "Vehicle with this number already exists" });
    }

    const rc_document = req.files?.rc_document?.[0]?.path || "";
    const insurance_document = req.files?.insurance_document?.[0]?.path || "";
    const vehicle_photos = req.files?.vehicle_photos?.map((p) => p.path) || [];

    const vehicle = await Vehicle.create({
      user_id,
      vehicle_number,
      vehicle_type,
      seat_capacity,
      rc_document,
      insurance_document,
      vehicle_photos,
      verification_status: "pending",
    });

    return res.status(201).json({
      message: "Vehicle Created",
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// Get single vehicle
const getVehicle = async (req, res, next) => {
  try {
    const { vehicle_id } = req.body;

    const vehicle = await Vehicle.findById(vehicle_id).populate(
      "user_id",
      "name email phone",
    );

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    res.status(200).json({
      message: "Vehicle fetched successfully",
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// to update Vehicle
const updateVehicle = async (req, res, next) => { 
  try {
    const { vehicle_id, vehicle_type, seat_capacity } = req.body;
    const authenticatedUserId = req.user.id;

    const vehicle = await Vehicle.findById(vehicle_id);

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    if (vehicle.user_id.toString() !== authenticatedUserId) {
      return res.status(403).json({
        message: "Not authorized to update this vehicle",
      });
    }

    const rc_document = req.files?.rc_document?.[0]?.path || null;
    const insurance_document = req.files?.insurance_document?.[0]?.path || null;
    const vehicle_photos = req.files?.vehicle_photos?.map((p) => p.path) || [];

    const updates = {};
    if (vehicle_type != null && vehicle_type !== "") updates.vehicle_type = vehicle_type;
    if (seat_capacity != null && seat_capacity !== "") updates.seat_capacity = Number(seat_capacity);
    if (rc_document) updates.rc_document = rc_document;
    if (insurance_document) updates.insurance_document = insurance_document;
    if (vehicle_photos.length) updates.vehicle_photos = vehicle_photos;

    const updated = await Vehicle.findByIdAndUpdate(vehicle_id, updates, {
      new: true,
      runValidators: true,
      context: "query",
    });

    res.status(200).json({
      message: "Vehicle updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Verify Vehicle
const verifyVehicle = async (req, res, next) => {
  try {
    const { verified_by, vehicle_id, verification_status } = req.body;

    // validate status
    if (!["verified", "rejected"].includes(verification_status)) {
      return res.status(400).json({
        message: "Invalid verification status",
      });
    }

    // find vehicle
    const vehicle = await Vehicle.findById(vehicle_id);

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    // prevent re-verification spam
    if (vehicle.verification_status === verification_status) {
      return res.status(400).json({
        message: `Vehicle already ${verification_status}`,
      });
    }

    // update status
    vehicle.verification_status = verification_status;

    // optional audit fields (recommended)
    vehicle.verified_by = verified_by; // add field if you want
    vehicle.verifiedAt = new Date();

    await vehicle.save();

    res.status(200).json({
      message: `Vehicle ${verification_status} successfully`,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// get Vehicle gallery
const getVehicleGallery = async (req, res, next) => {
  try {
    const { vehicle_id } = req.body;
    if (!vehicle_id) {
      return res.status(400).json({ message: "vehicle_id is required" });
    }
    const vehicle = await Vehicle.findById(vehicle_id)
      .select(
        "vehicle_number vehicle_type rc_document insurance_document vehicle_photos ",
      )
      .lean();

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    if (!vehicle.vehicle_photos || vehicle.vehicle_photos.length === 0) {
      return res
        .status(404)
        .json({ message: "No photos found for this vehicle" });
    }

    return res.status(200).json({
      message: "Fetched Vehicle Gallery",
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};


// get vehicles by user_id
const getUserVehicles = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "user_id is required" });
    }

    const vehicles = await Vehicle.find({ user_id }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Vehicles fetched successfully",
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVehicle,
  getVehicle,
  updateVehicle,
  verifyVehicle,
  getVehicleGallery,
  getUserVehicles,
};
