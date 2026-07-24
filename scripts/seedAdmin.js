require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../src/apis/user/userModel");

(async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);

    const adminExists = await User.findOne({
      role: "admin",
    });

    if (adminExists) {
      console.log("Admin already exists");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await User.create({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
      provider: "email",
    });

    console.log("Admin created successfully");

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
