const driverAssignModel = require("../driverAssignment/driverAssignModel");
const User = require("../user/userModel");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../../config/mailer");

const registerDriver = async (req, res, next) => {
  try {
    const { ownerID, name, email, password, phone, gender, documentType } =
      req.body;

    const profilePicture = req.files?.profilePicture?.[0]?.path || "";
    const documentFront = req.files?.documentFront?.[0]?.path || "";
    const documentBack = req.files?.documentBack?.[0]?.path || "";

    if (
      !email ||
      !password ||
      !documentType ||
      !documentFront ||
      !documentBack
    ) {
      return res.status(400).json({
        message: "Email, Password, and Documents are required",
      });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const driver = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      gender,
      profilePicture,
      documentType,
      documentFront,
      documentBack,
      role: "driver",
      provider: "email",
      verifiedBy: ownerID,
      verificationStatus: "approved",
    });

    sendEmail({
      to: email,
      subject: "Welcome to CAARVAN — Your Driver Account Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to CAARVAN, ${name}!</h2>
          <p>Your driver account has been created by your fleet owner. Use the credentials below to log into the driver panel:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <p style="color: #666; font-size: 13px;">Please log in and update your profile. For security, we recommend changing your password after first login.</p>
          <p style="color: #999; font-size: 12px;">If you did not expect this email, please contact your fleet owner.</p>
        </div>
      `,
    }).catch((err) => console.error("Failed to send driver credentials email:", err.message));

    return res.status(201).json({
      message: "Driver Created",
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

const updateDriver = async (req, res, next) => {
  try {
    const { driverID, documentType, phone } = req.body;
    const documentFront = req.files?.documentFront?.[0]?.path;
    const documentBack = req.files?.documentBack?.[0]?.path;
    const profilePicture = req.files?.profilePicture?.[0]?.path || "";

    const driver = await User.findById(driverID);
    if (!driverID) {
      return res.status(404).json({
        message: "Driver Not Found",
      });
    }
    if (phone) driver.phone = phone;
    if (documentType) driver.documentType = documentType;

    if (profilePicture) driver.profilePicture = profilePicture;
    if (documentFront) driver.documentFront = documentFront;
    if (documentBack) driver.documentBack = documentBack;

    await driver.save();

    return res.status(200).json({
      success: true,
      message: "Driver updated successfully",
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

const getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await User.find({ role: "driver" }).select("-password");

    return res.status(200).json({
      message: "Fetched All Drivers",
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    next(error);
  }
};

const getDriverById = async (req, res, next) => {
  try {
    const { driverID } = req.body;

    if (!driverID) {
      return res.status(400).json({
        message: "DriverID is required",
      });
    }
    const driver = await User.findById(driverID);
    if (!driver) {
      return res.status(404).json({
        message: "Driver Not Found",
      });
    }

    return res.status(200).json({
      message: "Fetched Driver By Id",
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

const getDriversByOwner = async (req, res, next) => {
  try {
    const { ownerID } = req.body;
    if (!ownerID) {
      return res.status(400).json({
        message: "ownerID is required",
      });
    }
    const drivers = await User.find({ verifiedBy: ownerID });

    return res.status(200).json({
      message: "Fetched Driver By Owner",
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    next(error);
  }
};

const getAssignedVehicles = async (req, res, next) => {
  try {
    const { driverID } = req.body;
    if (!driverID) {
      return res.status(400).json({
        message: "DriverID is required",
      });
    }

    const vehicles = await driverAssignModel.find({
      driverId: driverID,
    });
    if (!vehicles.length > 0) {
      return res.status(400).json({
        message: "No Vehicles Assigned",
      });
    }
    return res.status(200).json({
      message: "Fetched Driver assigned Vehicles",
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  registerDriver,
  updateDriver,
  getAllDrivers,
  getDriverById,
  getDriversByOwner,
  getAssignedVehicles,
};
