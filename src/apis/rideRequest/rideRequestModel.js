const mongoose = require("mongoose");

const RideSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    trip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },

    source: {
      type: String,
      required: true,
    },

    destination: {
      type: String,
      required: true,
    },

    preferred_time: {
      type: Date,
      required: true,
    },

    seats_required: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("RideRequest", RideSchema);
