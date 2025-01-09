var express = require("express");
const session = require("express-session");
var morgan = require("morgan");
const passport = require("passport");
// const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");
const app = express();
const { PORT } = require("./config");
const cors = require("cors");
const databaseConnection = require("./database/db");
const { Server } = require("socket.io"); // Importing socket.io

// Game Logic Imports
const {
  joinQueue,
  checkInactivePlayers,
  handleLeaveQueue,
} = require("./Configuration/firstsocket"); // Make sure these functions are correctly exported in 'socket.js'

// Game Logic Imports
const { eventFormeet, handleLeaveMeetQueue } = require("./Configuration/thirdsocket");

databaseConnection();
// Configure session middleware
app.use(
  session({
    secret: "your_secret_key", // replace with a secure key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set secure to true if you're using HTTPS
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // allowedHeaders: ["Content-Type", "x-access-token"], // Allow x-access-token in headers
    credentials: true,
  })
);
app.use(morgan("tiny"));
app.use(express.json());
// Middleware for parsing JSON requests
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// route connection
app.use("/", require("./routes"));

// Set up HTTP server with Express
const server = app.listen(PORT, () => {
  console.log(`App listening on port ${process.env.PORT}!`);
});

// Set up Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // React Client URL
    // origin: "https://www.multinetworkingcompany.com", // React Client URL
    methods: ["GET", "POST"],
  },
});

// In-memory player queue
const waitingPlayers = [];

const meetwaitingPlayers = [];
// Handle socket connections and game logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  // Handle leaveQueue for the general waiting queue
  handleLeaveQueue(socket, waitingPlayers, io);

  // Handle leaveQueue for the matchmaking queue
  handleLeaveMeetQueue(socket, meetwaitingPlayers, io);
  // Join queue event
  socket.on("joinQueue", ({ level, playerId }) => {
    console.log("playerId", playerId);
    joinQueue(socket, waitingPlayers, io, playerId, level);
  });

  socket.on("eventFormeet", ({ playerId, role }) => {
    eventFormeet(socket, meetwaitingPlayers, io, playerId, role);
  });
  // Handle player disconnect
  socket.on("disconnectMessage", () => {
    const index = waitingPlayers.findIndex(
      (player) => player?.playerId === socket?.id
    );
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
  });

  // Periodically check for inactive players
  setInterval(() => {
    checkInactivePlayers(waitingPlayers, io);
  }, 1000);
});

module.exports = server;
