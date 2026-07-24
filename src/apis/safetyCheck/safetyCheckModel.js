const mongoose = require("mongoose");

const checklistItemSchema = {
  status: {
    type: String,
    enum: ["ok", "needs_attention", "critical"],
    required: true,
  },
  notes: {
    type: String,
    default: null,
    trim: true,
  },
};

const SafetyCheck = new mongoose.Schema(
  {
    trip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    fuel: checklistItemSchema,

    tyres: checklistItemSchema,

    brakes: checklistItemSchema,

    documents: checklistItemSchema,

    cleanliness: checklistItemSchema,

    overall_status: {
      type: String,
      enum: ["passed", "failed"],
      default: "passed",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SafetyCheck", SafetyCheck);
