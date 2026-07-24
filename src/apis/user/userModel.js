const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      select: false,
    },

    gender: {
      type: String,
      enum: ["male", "female", "others"],
    },

    profilePicture: {
      type: String,
    },

    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },

    provider: {
      type: String,
      enum: ["email", "google", "phone"],
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "owner", "driver", "customer"],
      required: true,
    },

    isVerified: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },

    documentType: {
      type: String,
      enum: ["aadhaar_card", "voter_card", "driving_license", "passport"],
    },

    documentFront: {
      type: String,
    },

    documentBack: {
      type: String,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    verifiedAt: {
      type: Date,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    rejectionReason: {
      type: String,
    },

    fcmToken: {
      type: String,
      select: false,
    },
  },

  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
