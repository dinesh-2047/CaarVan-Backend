// const { Server } = require("socket.io");

// let io;

// //Initailizing socketio server
// //Any forntend application can connect to the web socket
// exports.initializeSocket = (server) => {
//   io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//     },
//   });

//   //This ia a listener that is fired when a user is connected
//   io.on("connection", (socket) => {
//     console.log("Client connected : ", socket.id);
//     socket.join("emergency-agents");
//     //This is a listener that runs when the connected user is disconnected
//     socket.on("disconnect", () => {
//       console.log("Client Disconnected : ", socket.id);
//     });
//   });
//   return io;
// };

// //This will check if socketio is working or not
// exports.getIO = () => {
//   if (!io) {
//     throw new Error("Socket not initialized");
//   }
//   return io;
// };



let io;

// Ab server nahi, io directly receive karo
exports.initializeSocket = (ioInstance) => {
  io = ioInstance;

  // SOS ke liye default namespace — sab connect hote hi emergency-agents room mein
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.join("emergency-agents");

    socket.on("disconnect", () => {
      console.log("Client Disconnected:", socket.id);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};