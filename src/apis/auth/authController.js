const bcrypt = require("bcrypt");
const admin = require("../../config/firebase");
const User = require("../user/userModel");
const { generateToken } = require("../../utils/jwt");
const twilioClient = require("../../config/twilio");

exports.createManager = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const manager = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "manager",
      provider: "email",
    });

    res.status(201).json({
      success: true,
      message: "Manager created successfully",
      manager: {
        id: manager._id,
        name: manager.name,
        email: manager.email,
        role: manager.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Account blocked",
      });
    }

    if (user.role !== "admin" && user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    
    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.firebaseLogin = async (req, res, next) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || !role) {
      return res.status(400).json({
        success: false,
        message: "idToken and role are required",
      });
    }

    if (role !== "owner" && role !== "customer") {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);

    let user = await User.findOne({
      firebaseUid: decoded.uid,
    });

    if (!user && decoded.email) {
      user = await User.findOne({ email: decoded.email });
    }

    if (!user && decoded.phone_number) {
      user = await User.findOne({ phone: decoded.phone_number });
    }

    if (user && user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Account blocked",
      });
    }

    if (user && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role}`,
      });
    }

    if (user) {
      const updates = { firebaseUid: decoded.uid };
      if (!user.email && decoded.email) updates.email = decoded.email;
      if (!user.phone && decoded.phone_number) updates.phone = decoded.phone_number;
      if (!user.name && decoded.name) updates.name = decoded.name;
      await User.findByIdAndUpdate(user._id, updates);
    } else {
      const newUser = {
        name: decoded.name || "",
        firebaseUid: decoded.uid,
        provider: "google",
        role,
      };
      if (decoded.email) newUser.email = decoded.email;
      if (decoded.phone_number) newUser.phone = decoded.phone_number;
      user = await User.create(newUser);
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phone,
        channel: "sms",
      });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, role } = req.body;

    if (!phone || !otp || !role) {
      return res.status(400).json({
        success: false,
        message: "Phone, OTP and role are required",
      });
    }

    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phone,
        code: otp,
      });

    if (verificationCheck.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        role,
        provider: "phone",
      });
    }

    if (user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account is registered as ${user.role}`,
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

exports.driverLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }
    const driver = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!driver) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (driver.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Account blocked",
      });
    }
    if (driver.role !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const isMatch = await bcrypt.compare(password, driver.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(driver);

    res.status(200).json({
      success: true,
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        role: driver.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
