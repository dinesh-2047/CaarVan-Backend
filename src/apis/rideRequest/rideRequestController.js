const APIFeatures = require("../../utils/apiTourFeatures");
const RideRequest = require("./rideRequestModel");

const createRideRequest = async (req, res, next) => {
  try {
    const { user_id, source, destination, preferred_time, seats_required } =
      req.body;

    const exist = await RideRequest.findOne({
      user_id,
      source,
      destination,
      status: "pending",
    });

    if (exist) {
      return res.status(400).json({
        message: "A ride has been already requested",
      });
    }

    if (
      !user_id ||
      !source ||
      !destination ||
      !preferred_time ||
      !seats_required
    ) {
      return res.status(400).json({
        message: "Please enter all fields",
      });
    }

    const ride = await RideRequest.create({
      user_id,
      source,
      destination,
      preferred_time,
      seats_required,
    });

    return res.status(200).json({
      success: true,
      message: "Ride requested successfully!",
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

const getRideRequests = async (req, res, next) => {
  try {
    const features = new APIFeatures(
      RideRequest.find()
        .populate("user_id", "name email")
        .populate("trip_id", "tripCode routeId vehicleId driverId fare"),
      req.query,
    )
      .filter()
      .sort()
      .paginate();
    const requests = await features.query;

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully!",
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

const getRideRequest = async (req, res, next) => {
  try {
    const { ride_id } = req.body;
    if (!ride_id) {
      return res.status(400).json({
        message: "Provide ride_id",
      });
    }
    const request = await RideRequest.findById(ride_id);
    if (!request) {
      return res.status(404).json({
        message: "Ride Request not found",
      });
    }

    return res.status(200).json({
      message: "Fetched Ride Request by Id",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
const convertRequestToTrip = async (req, res, next) => {
  try {
    const { requestId, user_id } = req.body;

    if (!requestId || !user_id) {
      return res.status(400).json({
        message: "requestId and user_id are required ",
      });
    }

    const request = await RideRequest.findById(requestId);

    if (!request) {
      return res.status(500).json({
        message: "No ride found",
      });
    }

    //This will check if the request belongs to the actual user
    if (request.user_id.toString() !== user_id) {
      return res.status(500).json({
        message: "Unauthorized user for this request",
      });
    }

    request.status = "accepted";
    await request.save();

    return res.status(200).json({
      message: "Ride successfully converted to trip",
      suceess: true,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRideRequest,
  getRideRequests,
  getRideRequest,
  convertRequestToTrip,
};
