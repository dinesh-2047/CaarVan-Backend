const DriverVehicleAssignment = require("./driverAssignModel");
const Vehicle = require("../vehicle/vehicleModel");
const User = require("../user/userModel");

const assignVehicleToDriver = async (req, res, next) => {
  try {
    const { userId, driverId, vehicleId } = req.body;

    // check driver
    const driver = await User.findById(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // check vehicle
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // check vehicle already assigned
    const existingVehicleAssignment = await DriverVehicleAssignment.findOne({
      vehicleId,
      status: "active",
    });

    if (existingVehicleAssignment) {
      return res.status(400).json({
        success: false,
        message: "Vehicle is already assigned",
      });
    }

    // check driver already has vehicle
    const existingDriverAssignment = await DriverVehicleAssignment.findOne({
      driverId,
      status: "active",
    });

    if (existingDriverAssignment) {
      return res.status(400).json({
        success: false,
        message: "Driver already has a vehicle assigned",
      });
    }
    // check driver has removed  vehicle
    const reassignSameDriver = await DriverVehicleAssignment.findOne({
      vehicleId,
      driverId,
      status: "removed",
    });

    if (reassignSameDriver) {
      reassignSameDriver.status = "active";
      await reassignSameDriver.save();

      return res.status(200).json({
        message: "Reassigned Driver",
      });
    }

    const assignment = await DriverVehicleAssignment.create({
      driverId,
      vehicleId,
      assignedBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Vehicle assigned successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

const removeVehicleAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.body;

    const assignment = await DriverVehicleAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    assignment.status = "removed";

    await assignment.save();

    res.status(200).json({
      success: true,
      message: "Vehicle assignment removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assignVehicleToDriver,
  removeVehicleAssignment,
};
