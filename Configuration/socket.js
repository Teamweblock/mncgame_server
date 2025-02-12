const Gamesession = require("../model/FirstGame/firstgameSession.model");
const Level = require("../model/Level.model");
const Player = require("../model/Player.model");
const { getFirstGameQuestions } = require("./comman");

// Function to check for inactive players (waiting for more than 2 minutes)
function checkInactivePlayers(waitingPlayers, io) {
  const currentTime = Date.now();

  waitingPlayers.forEach((player, index) => {
    const waitTime = currentTime - player.timestamp;
    if (waitTime > 2 * 60 * 1000) {
      // If the player has been waiting for more than 2 minutes
      waitingPlayers.splice(index, 1);
      const socketToDisconnect = io.sockets.sockets.get(player.socketId); // Correcting playerId to socketId
      if (socketToDisconnect) {
        socketToDisconnect.emit(
          "disconnectMessage",
          "You waited too long, no match found."
        );
        socketToDisconnect.disconnect();
      }
    }
  });
}

// Room creation function to handle paired players
const createRoomAndNotifyPlayers = async (player1, player2, io, level) => {
  // Create room with unique room code
  const roomCode = generateRoomCode();

  // Update both player sessions
  await Gamesession.updateMany(
    { playerId: { $in: [player1.id, player2.id] } },
    {
      $set: {
        "levelScores.$[elem].isPaired": true,
        "levelScores.$[elem].roomCode": roomCode,
      },
    },
    { arrayFilters: [{ "elem.level": level._id }] }
  );

  // Notify players through Socket.io
  io.to(player1.socketId).emit("matchFound", { roomCode, level });
  io.to(player2.socketId).emit("matchFound", { roomCode, level });
};

// Function to add a player to the queue and attempt matchmaking
async function joinQueue(socket, waitingPlayers, io, playerId, level) {
  const playerData = {
    socketId: socket.id,
    playerId,
    timestamp: Date.now(),
    level,
  };
  console.log('playerData', playerData);

  // Check if player exists and is active
  const player = await Player.findById(playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  if (player.userType !== "active") {
    socket.emit(
      "disconnectMessage",
      "You are inactive and cannot join the queue."
    );
    socket.disconnect();
    return;
  }

  // Add player to waiting list
  waitingPlayers.push(playerData);

  // Try to find a match if there are at least two players in the queue
  if (waitingPlayers.length >= 2) {
    matchPlayers(waitingPlayers, io);
  }

  // Set a timeout to disconnect the player if no match is found within 2 minutes
  setTimeout(() => {
    const playerIndex = waitingPlayers.indexOf(playerData);
    if (playerIndex > -1) {
      waitingPlayers.splice(playerIndex, 1);
      socket.emit("disconnectMessage", "You waited too long, no match found.");
      socket.disconnect();
    }
  }, 2 * 60 * 1000); // 2-minute timeout
}

// Function to handle player matching and room creation
async function matchPlayers(waitingPlayers, io) {
  const [player1, player2] = waitingPlayers.splice(0, 2);

  // Ensure both players are active
  const isActive1 = await Player.findById(player1.playerId);
  const isActive2 = await Player.findById(player2.playerId);
  if (
    !isActive1 ||
    isActive1.userType !== "active" ||
    !isActive2 ||
    isActive2.userType !== "active"
  ) {
    // If either player is inactive, skip pairing and disconnect
    if (!isActive1 || isActive1.userType !== "active") {
      disconnectPlayer(player1, io, "Inactive user cannot join.");
    }
    if (!isActive2 || isActive2.userType !== "active") {
      disconnectPlayer(player2, io, "Inactive user cannot join.");
    }
    return;
  }

  // Check if both players are on the same level
  // Start the process of looking for a matching player
  await findMatchingPlayer(waitingPlayers, io);
  // if (player1.level !== player2.level) {
  //   waitingPlayers.unshift(player1, player2); // Return players to queue if levels do not match
  //   console.log("Players have different levels, waiting for same-level match.");
  //   return;
  // }

  // Check wait time
  const waitTime = Date.now() - player1.timestamp;
  if (waitTime > 2 * 60 * 1000) {
    // Player 1 waited too long
    disconnectPlayer(player1, io, "You waited too long, no match found.");
    return;
  }

  // Fetch and ensure players haven’t completed the level
  const levelCheck1 = await Level.findOne({ levelNumber: player1.level });
  const levelCheck2 = await Level.findOne({ levelNumber: player2.level });
  const sessionCheck1 = await Gamesession.findOne({
    playerId: player1.playerId,
    completedLevels: { $ne: levelCheck1._id },
  });
  const sessionCheck2 = await Gamesession.findOne({
    playerId: player2.playerId,
    completedLevels: { $ne: levelCheck2._id },
  });

  if (!sessionCheck1 || !sessionCheck2) {
    // If either player has completed the level, disconnect them and return the other player to the queue
    if (!sessionCheck1) {
      disconnectPlayer(
        player1,
        io,
        "You have completed this level, disconnected."
      );
    }
    if (!sessionCheck2) {
      disconnectPlayer(
        player2,
        io,
        "You have completed this level, disconnected."
      );
    }
    // Ensure the other player remains in the queue
    if (!sessionCheck1) {
      waitingPlayers.unshift(player2);
    }
    if (!sessionCheck2) {
      waitingPlayers.unshift(player1);
    }
    return;
  }

  // All conditions are met: create a match
  createMatch(io, player1, player2, waitingPlayers);
}

// Function to find a matching player
async function findMatchingPlayer(waitingPlayers, io) {
  const startTime = Date.now(); // Track the start time

  // Try to find a matching player within 2 minutes
  while (waitingPlayers.length > 0) {
    const player1 = waitingPlayers[0];

    // Check if 2 minutes have passed
    if (Date.now() - startTime > 2 * 60 * 1000) {
      // No match found within the time limit
      disconnectPlayer(player1, io, "You waited too long, no match found.");
      return;
    }

    // Look for a player with the same level
    const player2 = waitingPlayers.find(
      (p) => p.level === player1.level && p.playerId !== player1.playerId
    );

    if (player2) {
      // Found a match, create the game
      waitingPlayers.splice(waitingPlayers.indexOf(player1), 1);
      waitingPlayers.splice(waitingPlayers.indexOf(player2), 1);
      await createMatch(io, player1, player2, waitingPlayers);
      return;
    }

    // If no match is found, we continue to check for others in the queue
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before checking again
  }
}

// Helper function to disconnect a player with a message
async function disconnectPlayer(playerData, io, message) {
  const playerSocket = io.sockets.sockets.get(playerData.socketId);
  if (playerSocket) {
    playerSocket.emit("disconnectMessage", message);
    playerSocket.disconnect();
  }
}

// Function to create a match and setup a room for both players
async function createMatch(io, player1, player2, waitingPlayers) {
  const roomCode = `room-${Math.random().toString(36).substr(2, 9)}`;

  const player1Socket = io.sockets.sockets.get(player1.socketId);
  const player2Socket = io.sockets.sockets.get(player2.socketId);

  if (player1Socket && player2Socket) {
    // Add players to the room
    player1Socket.join(roomCode);
    player2Socket.join(roomCode);

    // Fetch initial game questions
    await Promise.all([
      getFirstGameQuestions({
        playerId: player1?.playerId,
        level: player1?.level,
        gametype: "multiple",
        roomCode: roomCode,
      }),
      getFirstGameQuestions({
        playerId: player2?.playerId,
        level: player2?.level,
        gametype: "multiple",
        roomCode: roomCode,
      }),
    ]);

    // Notify both players
    io.to(roomCode).emit("startGame", roomCode);
    io.to(roomCode).emit("playersReady", {
      player1Id: player1.playerId,
      player2Id: player2.playerId,
    });

    console.log(`Players paired in room: ${roomCode}`);

    player1Socket.on("disconnect", () =>
      handlePlayerExit(player1, player2, io, waitingPlayers)
    );
    player2Socket.on("disconnect", () =>
      handlePlayerExit(player2, player1, io, waitingPlayers)
    );

  } else {
    console.error("One or both player sockets not found");
  }
}

// Function to handle when a player exits or disconnects
async function handlePlayerExit(disconnectedPlayer, remainingPlayer, io, waitingPlayers) {
  console.log(`Player ${disconnectedPlayer.playerId} disconnected.`);

  // Notify the remaining player
  const remainingPlayerSocket = io.sockets.sockets.get(
    remainingPlayer.socketId
  );
  if (remainingPlayerSocket) {
    remainingPlayerSocket.emit("playerDisconnected", {
      message: `Player ${disconnectedPlayer.playerId} has disconnected. You will be returned to the queue to find a new match.`,
    });

    // Add the remaining player back to the waiting queue to find a new opponent
    waitingPlayers.push(remainingPlayer);

    // You can also optionally clear the room or return the disconnected player to the queue
    remainingPlayerSocket.leave(disconnectedPlayer.roomCode); // Leave the room
  }
}

module.exports = { joinQueue, checkInactivePlayers, matchPlayers };
