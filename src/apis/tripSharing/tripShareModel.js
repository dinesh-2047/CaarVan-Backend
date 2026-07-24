const mongoose = require("mongoose");

const tripShareSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      unique: true,
    },

    shareCode: {
      type: String,
      required: true,
      unique: true,
    },

    clicks: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("TripShare", tripShareSchema);
