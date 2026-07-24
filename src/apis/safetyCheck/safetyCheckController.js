const mongoose = require("mongoose");
const SafetyCheck = require("./safetyCheckModel");
const APIFeatures = require("../../utils/apiTourFeatures");

// Submit Safety CheckList - to be submitted by driver before trip
const submitSafetyCheck = async (req, res, next) => {
  try {
    const { user_id, trip_id, fuel, tyres, brakes, documents, cleanliness } =
      req.body;

    if (!trip_id) {
      return res.status(400).json({ message: "trip_id is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(trip_id)) {
      return res.status(400).json({ message: "Invalid trip_id" });
    }

    const requiredItems = { fuel, tyres, brakes, documents, cleanliness };
    const missingItems = Object.keys(requiredItems).filter(
      (key) => !requiredItems[key]?.status,
    );

    if (missingItems.length > 0) {
      return res.status(400).json({
        message: `Missing status for: ${missingItems.join(", ")}`,
      });
    }

    // Prevent duplicate submission for same trip
    const existing = await SafetyCheck.findOne({ trip_id });
    if (existing) {
      return res.status(409).json({
        message: "Safety check already submitted for this trip",
      });
    }

    // Auto-compute overall_status
    const checkItems = [fuel, tyres, brakes, documents, cleanliness];
    const hasCritical = checkItems.some((item) => item.status === "critical");
    const overall_status = hasCritical ? "failed" : "passed";

    const safetyCheck = await SafetyCheck.create({
      trip_id,
      submitted_by: user_id,
      fuel,
      tyres,
      brakes,
      documents,
      cleanliness,
      overall_status,
    });

    return res.status(201).json({
      success: true,
      message: "Safety check submitted successfully",
      overall_status,
      data: safetyCheck,
    });
  } catch (error) {
    next(error);
  }
};

// GET SAFETY CHECK
const getSafetyCheck = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      SafetyCheck.find()
        .populate("submitted_by", "name email")
        .populate("trip_id", "tripCode vehicleId driverId")
        .lean(),
      req.query,
    )
      .filter()
      .sort()
      .paginate();
    const safetyCheck = await features.query;

    if (safetyCheck.length <= 0) {
      return res
        .status(404)
        .json({ message: "Safety check not found for trip" });
    }

    return res.status(200).json({
      success: true,
      data: safetyCheck,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitSafetyCheck, getSafetyCheck };
