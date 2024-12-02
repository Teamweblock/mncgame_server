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
  matchPlayers,
} = require("./Configuration/socket"); // Make sure these functions are correctly exported in 'socket.js'

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
    methods: ["GET", "POST"],
  },
});

// In-memory player queue
const waitingPlayers = [];
// Handle socket connections and game logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join queue event
  socket.on('joinQueue', ({ playerId, level }) => {
    console.log("playerId", playerId);

    joinQueue(socket, waitingPlayers, io, playerId, level);
  });

  // Handle player disconnect
  socket.on('disconnectMessage', () => {
    const index = waitingPlayers.findIndex((player) => player?.playerId === socket?.id);
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
