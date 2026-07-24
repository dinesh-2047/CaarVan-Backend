const router = require("express").Router();

const authController = require("../apis/auth/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.post(
  "/create-manager",
  authMiddleware,
  roleMiddleware("admin"),
  authController.createManager,
);
router.post("/login", authController.login);
router.post("/firebase-login", authController.firebaseLogin);
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("manager"),
  (req, res) => {
    res.json({
      success: true,
      message: "Manager Dashboard",
    });
  },
);
router.post("/driver-login", authController.driverLogin);

module.exports = router;
