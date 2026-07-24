const mongoose = require("mongoose");

const driverVehicleAssignmentSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    assignedDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "DriverVehicleAssignment",
  driverVehicleAssignmentSchema
);