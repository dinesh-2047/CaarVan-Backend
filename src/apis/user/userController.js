const crypto = require("crypto");
const User = require("./userModel");
const notify = require("../../utils/notify");
const { sendEmail } = require("../../config/mailer");

// In-memory OTP store: key -> { otp, email, expiresAt }
const otpStore = new Map();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// API to send KYC email OTP
const sendKycEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        success: false,
        message: "SMTP not configured on the server. Contact admin.",
      });
    }

    const otp = generateOtp();
    const key = `${req.user.id}_${email}`;
    otpStore.set(key, { otp, email, expiresAt: Date.now() + 10 * 60 * 1000 });

    await sendEmail({
      to: email,
      subject: "KYC Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Use the OTP below to verify your email for KYC:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; text-align: center; padding: 16px; background: #f0f5ff; border-radius: 8px; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This OTP is valid for 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true, message: "OTP sent to your email." });
  } catch (error) {
    next(error);
  }
};

// API to verify KYC email OTP
const verifyKycEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const key = `${req.user.id}_${email}`;
    const record = otpStore.get(key);

    if (!record) {
      return res.status(400).json({ success: false, message: "No OTP sent to this email. Request a new one." });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ success: false, message: "OTP has expired. Request a new one." });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Try again." });
    }

    otpStore.delete(key);

    await User.findByIdAndUpdate(req.user.id, { email, emailVerified: true });

    return res.status(200).json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    next(error);
  }
};

// API to upload KYC
const uploadKYC = async (req, res, next) => {
  try {
    const { userId, email, phone, gender, documentType } = req.body;
    const profilePicture = req.files?.profilePicture?.[0]?.path || "";

    const documentFront = req.files?.documentFront?.[0]?.path || "";

    const documentBack = req.files?.documentBack?.[0]?.path || "";

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.email && !email) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address to complete KYC.",
      });
    }

    if (!user.phone && !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide your phone number to complete KYC.",
      });
    }

    if (!user.emailVerified && !user.email) {
      return res.status(400).json({
        success: false,
        message: "Email not verified. Please verify your email before submitting KYC.",
      });
    }

    if (!user.gender && !gender) {
      return res.status(400).json({
        success: false,
        message: "Please select your gender.",
      });
    }

    if (!user.documentType && !documentType) {
      return res.status(400).json({
        success: false,
        message: "Please select a document type.",
      });
    }

    if (!req.files?.documentFront?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Please upload the front side of your ID document.",
      });
    }

    if (!req.files?.documentBack?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Please upload the back side of your ID document.",
      });
    }

    const updateData = {
      verificationStatus: "pending",
      documentFront: req.files.documentFront[0].path,
      documentBack: req.files.documentBack[0].path,
      ...(gender && { gender }),
      ...(documentType && { documentType }),
      ...(profilePicture && { profilePicture }),
      ...(!user.email && email && { email }),
      ...(!user.phone && phone && { phone }),
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    return res.status(200).json({
      success: true,
      message: "KYC uploaded successfully. Waiting for approval.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// API to get KYC status
const getKYCStatus = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId).select(
      "name email emailVerified phone gender profilePicture documentType documentFront documentBack verificationStatus rejectionReason verifiedAt",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// API to approve KYC
const approveKYC = async (req, res, next) => {
  try {
    const { userId, verifiedBy } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Can't approve if nothing was uploaded
    if (!user.documentFront || !user.documentBack) {
      return res.status(400).json({
        success: false,
        message: "User has not uploaded KYC documents yet.",
      });
    }

    // Can't approve if already approved
    if (user.verificationStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        verificationStatus: "approved",
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason: "", // clear any old rejection reason
      },
      { new: true },
    ).select("-password");

    // Send KYC approval notification
    await notify({
      userId: updatedUser._id,
      title: "KYC Verification Approved",
      message: "Congratulations! Your KYC documents have been verified and approved.",
      type: "SUCCESS",
      metadata: { userId: updatedUser._id.toString() }
    });

    return res.status(200).json({
      success: true,
      message: "KYC approved successfully.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// API to reject KYC
const rejectKYC = async (req, res, next) => {
  try {
    const { userId, verifiedBy, rejectionReason } = req.body;

    // Rejection reason is mandatory — admin must explain why
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a rejection reason.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Can't reject if already approved
    if (user.verificationStatus === "approved") {
      return res.status(400).json({
        success: false,
        message: "KYC is already approved. Cannot reject.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        verificationStatus: "rejected",
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason,
      },
      { new: true },
    ).select("-password");

    // Send KYC rejection notification
    await notify({
      userId: updatedUser._id,
      title: "KYC Verification Rejected",
      message: `Your KYC verification was rejected. Reason: ${rejectionReason}`,
      type: "DANGER",
      metadata: { userId: updatedUser._id.toString(), rejectionReason }
    });

    return res.status(200).json({
      success: true,
      message: "KYC rejected.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendKycEmailOtp,
  verifyKycEmailOtp,
  uploadKYC,
  getKYCStatus,
  approveKYC,
  rejectKYC,
};
