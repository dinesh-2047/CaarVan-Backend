const mongoose = require("mongoose");

const sosSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },
    // tripId: {
    //   type: Number,
    //   required: true,
    // },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // userId: {
    //   type: Number,
    //   required: true,
    // },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    locationHistory: [
      {
        latitude: Number,
        longitude: Number,
        timestamp: Date,
      },
    ],
    emergencyType: {
      type: String,
      enum: [
        "ACCIDENT",
        "MECHANICAL BREAKDOWN",
        "SECURITY",
        "MEDICAL",
        "OTHERS",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PENDING",
        "RESOLVED",
        "CANCELLED",
        "NONE",
        "FALSE ALARM",
      ],
      default: "NONE",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const EmergencyModel = mongoose.model("EmergencyModel", sosSchema);
module.exports = EmergencyModel;
