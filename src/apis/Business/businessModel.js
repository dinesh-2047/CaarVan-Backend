const mongoose = require("mongoose");
const BusinessSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    business_name: {
      type: String,
      trim: true,
    },

    gst_number: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    },

    vehicles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
      },
    ],

    verification_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    verifiedAt: Date,

    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = new mongoose.model("Business", BusinessSchema);
