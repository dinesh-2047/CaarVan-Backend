const Route = require("./routeModel");
const APIFeatures = require("../../utils/apiTourFeatures");

// API to create Route
const createRoute = async (req, res, next) => {
  try {
    const {
      route_code,
      source,
      destination,
      checkpoints,
      distance,
      estimated_duration,
    } = req.body;

    const existingRoute = await Route.findOne({ route_code });
    if (existingRoute) {
      return res.status(400).json({
        success: false,
        message: `Route with code "${route_code}" already exists.`,
      });
    }

    if (checkpoints && checkpoints.length > 0) {
      const isInvalid = checkpoints.some((cp) => !cp.city || !cp.arrival_time);
      if (isInvalid) {
        return res.status(400).json({
          success: false,
          message: "Each checkpoint must have a city and an arrival_time.",
        });
      }
    }

    const route = await Route.create({
      route_code,
      source,
      destination,
      checkpoints,
      distance,
      estimated_duration,
    });

    return res.status(201).json({
      success: true,
      message: "Route created successfully.",
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

// API to update Route - can only change checkpoints
const updateRoute = async (req, res, next) => {
  try {
    const { id, checkpoints } = req.body;

    if (!checkpoints || checkpoints.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide checkpoints to update.",
      });
    }

    const isInvalid = checkpoints.some((cp) => !cp.city || !cp.arrival_time);
    if (isInvalid) {
      return res.status(400).json({
        success: false,
        message: "Each checkpoint must have a city and an arrival_time.",
      });
    }

    const updatedRoute = await Route.findByIdAndUpdate(
      id,
      { checkpoints },
      { new: true, runValidators: true },
    );

    if (!updatedRoute) {
      return res.status(404).json({
        success: false,
        message: "Route not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Checkpoints updated successfully.",
      data: updatedRoute,
    });
  } catch (error) {
    next(error);
  }
};

// API to delete Route
const deleteRoute = async (req, res, next) => {
  try {
    const { id } = req.body;

    const deletedRoute = await Route.findByIdAndDelete(id);

    if (!deletedRoute) {
      return res.status(404).json({
        success: false,
        message: "Route not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Route deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// API to get all Routes (with optional filter , sort, pagination)
const getRoutes = async (req, res, next) => {
  try {
    const features = new APIFeatures(Route.find(), req.query)
      .filter()
      .sort()
      .paginate();

    const routes = await features.query;

    const totalFeatures = new APIFeatures(Route.find(), req.query).filter();
    const total = await totalFeatures.query.countDocuments();

    return res.status(200).json({
      success: true,
      total,
      page: Number(req.query.page) || 1,
      totalPages: Math.ceil(total / (Number(req.query.limit) || 10)),
      results: routes.length,
      data: routes,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRoute, updateRoute, deleteRoute, getRoutes };
