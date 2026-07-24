require("dotenv").config({ quiet: true });
const express = require("express");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const { Server } = require('socket.io');

const connectDB = require("./config/database");
const adminRoutes = require("./routes/adminRoutes");
const driverRoutes = require("./routes/driverRoutes");
const publicRoutes = require("./routes/publicRoutes");
const authRoutes = require("./routes/authRoutes");
const { errorHandler } = require("./middlewares/errorHandler");
const { initializeSocket } = require("./socket/socket");
const initTrackingSocket = require('./apis/locationHistory/trackingSocket');
const { startSeatHoldExpiryCron } = require("./utils/seatHoldExpiryCron");

app.use(cors({
  origin:"*",
  methods:['GET', 'POST',"PUT", 'DELETE',"OPTIONS"],
  allowedHeaders:['Content-Type', 'Authorization']
}));
// Allow cross-origin images (frontend at localhost, images at API host)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(express.static(path.join(__dirname, "public")));
// FIX: multer saves file paths with "src/uploads/" prefix, and __dirname is
// project-root/src, so path.join(__dirname, "uploads") resolves to src/uploads/
app.use("/src/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    message: "CarVan Backend API Running",
  });
});

app.use("/admin", adminRoutes);
app.use("/driver", driverRoutes);
app.use("/api", publicRoutes);
app.use("/auth", authRoutes);

app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
});


app.use(errorHandler);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Dono ko same io pass karo
initializeSocket(io);   // SOS wala — default namespace
initTrackingSocket(io); // Tracking wala — /tracking namespace

startSeatHoldExpiryCron()

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer()