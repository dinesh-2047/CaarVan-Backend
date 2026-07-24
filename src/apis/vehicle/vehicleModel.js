const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicle_number: {
      type: String,
      unique: true,
      required: true,
      minlength: 8,
      maxlength: 11,
      uppercase: true,
    },
    vehicle_type: {
      type: String,
      enum: ["car", "bus", "luxury"],
      default: "car",
      required: true,
    },
    seat_capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    rc_document: {
      type: String,
    },
    insurance_document: {
      type: String,
    },
    vehicle_photos: [
      {
        type: String,
      },
    ],
    verification_status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedAt: Date,

    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
