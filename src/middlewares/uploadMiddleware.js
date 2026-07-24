const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.id;

    let uploadPath = "";

    // profile image

    if (file.fieldname === "profilePicture") {
      uploadPath = `src/uploads/users/${userId}/profile`;
    }

    // id front

    if (file.fieldname === "documentFront") {
      uploadPath = `src/uploads/users/${userId}/id-proof/front`;
    }

    // id back

    if (file.fieldname === "documentBack") {
      uploadPath = `src/uploads/users/${userId}/id-proof/back`;
    }

    // rc
    if (file.fieldname === "rc_document") {
      uploadPath = `src/uploads/vehicle/${userId}/rc`;
    }

    // insurance
    if (file.fieldname === "insurance_document") {
      uploadPath = `src/uploads/vehicle/${userId}/insurance`;
    }

    // vehicle pics
    if (file.fieldname === "vehicle_photos") {
      uploadPath = `src/uploads/vehicle/${userId}/vehicle-pics`;
    }

    // trip banner pics
    if (file.fieldname === "tripBanner") {
      uploadPath = `src/uploads/trips/${userId}/trips-banner`;
    }

    // payment proof screenshot
    if (file.fieldname === "screenshot") {
      uploadPath = `src/uploads/payments/${userId}/proof`;
    }

    fs.mkdirSync(uploadPath, {
      recursive: true,
    });

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
});

module.exports = upload;
