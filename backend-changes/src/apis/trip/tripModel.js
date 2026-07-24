const mongoose = require("mongoose");

const TRIP_STATUS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
];

const CATEGORY_NAMES = [
  "Religious Tour",
  "Tour",
  "Carpool",
  "Safe Ride",
  "Ladies Only",
  "Luxury Ride",
  "Regular Ride",
];

// trip category schema
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      enum: {
        values: CATEGORY_NAMES,
        message: `Category must be one of: ${CATEGORY_NAMES.join(",")}`,
      },
      trim: true,
    },

    colorCode: {
      type: String,
      required: [true, "Category color code is required"],
      trim: true,
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid color code"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
  },
  { _id: false },
);

// trip schema
const tripSchema = new mongoose.Schema(
  {
    tripCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: [true, "Route is required"],
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: [true, "Vehicle is required"],
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"],
    },

    category: {
      type: categorySchema,
      required: [true, " Category is required"],
    },

    isLadiesOnly: {
      type: Boolean,
      default: false,
    },

    departureTime: {
      type: Date,
      required: [true, "Departure time is required"],
    },

    arrivalTime: {
      type: Date,
      required: [true, "Arrival time is required"],
    },

    seatCapacity: {
      type: Number,
      required: [true, "Seat capacity is required"],
      min: [1, "Seat capacity must be at least 1"],
    },

    availableSeats: {
      type: Number,
      min: [0, "Avaiable seats cannot be negative"],
    },

    fare: {
      type: Number,
      required: [true, "Fare is required"],
      min: [0, "Fare cannot be negative"],
    },

    status: {
      type: String,
      enum: {
        values: TRIP_STATUS,
        message: `Status must be one of: ${TRIP_STATUS.join(",")}`,
      },
      default: "PENDING",
    },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    startedAt: {
      type: Date,
    },

    endedAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    cancellationReason: {
      type: String,
      trim: true,
    },

    tripBanner: {
      type: String,
      trim: true,
    },

    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },

    submitForApproval: {
      type: Boolean,
      default: false,
    },

    submittedAt: {
      type: Date,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },

    // ===== CHANGED: added checkpoints field =====
    checkpoints: [
      {
        city: { type: String, trim: true },
        arrival_time: { type: Date },
        order: { type: Number },
      },
    ],
  },
  { timestamps: true },
);

tripSchema.index({ status: 1, departureTime: 1 });
tripSchema.index({ driverId: 1 });
tripSchema.index({ routeId: 1 });
tripSchema.index({ "category.name": 1 });
tripSchema.index({ isLadiesOnly: 1, status: 1 });
tripSchema.index({ currentLocation: '2dsphere' });

tripSchema.pre("save", async function () {
  // auto-generate trip code on first save
  if (!this.tripCode) {
    const ts = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.tripCode = `TRP-${ts}-${randomStr}`;
  }

  // isLadiesOnly category check
  if (this.category && this.isModified("category")) {
    this.isLadiesOnly = this.category.name === "Ladies Only";
  }

  //  avaiable seats = seat capacity when created
  if (this.isNew && this.availableSeats === undefined) {
    this.availableSeats = this.seatCapacity;
  }

  // arrival after departure check
  if (this.departureTime && this.arrivalTime) {
    if (this.arrivalTime <= this.departureTime) {
      throw new Error("Arrival time must be after departure time");
    }
  }
});

const Trip = mongoose.model("Trip", tripSchema);

module.exports = { Trip, TRIP_STATUS, CATEGORY_NAMES };
