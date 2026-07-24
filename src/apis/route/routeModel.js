const mongoose = require("mongoose");
const { stringify } = require("uuid");

const routeSchema = new mongoose.Schema(
  {
    route_code: {
      type: String,
      unique: true,
      required: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    checkpoints: [
      {
        city: String,
        arrival_time: Date,
      },
    ],
    distance: {
      type: String,
      required: true,
      trim: true,
    },
    estimated_duration: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = new mongoose.model("Route", routeSchema);
