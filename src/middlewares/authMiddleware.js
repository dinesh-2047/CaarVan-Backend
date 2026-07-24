const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authHeader;

    req.user = jwt.verify(token, process.env.JWT_SECRET);

    next();
  } catch (error) {
    error.statusCode = 401;

    next(error);
  }
};
