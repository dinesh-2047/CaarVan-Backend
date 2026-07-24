const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Invalid Mongo ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = `${Object.keys(err.keyValue)[0]} already exists`;
  }

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production" &&
      statusCode === 500
        ? "Something went wrong"
        : message,
  });
};

module.exports = {
  errorHandler,
};