const Gamesession = require("../model/FirstGame/multipleSession.model");
const Player = require("../model/Player.model");
const { getFirstGameQuestions } = require("./comman");

// Function to add a player to the queue and attempt matchmaking
async function joinQueue(socket, levelGroups, io, playerId, level) {
  const playerData = {
    socketId: socket.id,
    playerId,
    timestamp: Date.now(),
    level,
  };

  // Ensure level group exists
  if (!levelGroups[level]) {
    levelGroups[level] = [];
  }

  // Verify player validity and activity
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

  // Avoid duplicate entries
  const isPlayerAlreadyInGroup = levelGroups[level].some(
    (p) => p.playerId === playerId
  );
  if (isPlayerAlreadyInGroup) {
    socket.emit("errorMessage", "You are already in the queue for this level.");
    return;
  }

  // Add player to level group and attempt matchmaking
  levelGroups[level].push(playerData);
  matchPlayers(levelGroups[level], io, level);

  // Handle 2-minute timeout for matchmaking
  setTimeout(() => {
    const playerIndex = levelGroups[level].findIndex(
      (p) => p.playerId === playerId
    );
    if (playerIndex !== -1) {
      levelGroups[level].splice(playerIndex, 1); // Remove player
      socket.emit("disconnectMessage", "You waited too long, no match found.");
      socket.disconnect();
    }
  }, 2 * 60 * 1000);
}

// Function to handle player matching and room creation
async function matchPlayers(waitingPlayers, io, level) {
  console.log("Waiting players:", waitingPlayers);

  // Match in groups of 3 players
  while (waitingPlayers.length >= 3) {
    const [player1, player2, player3] = waitingPlayers.splice(0, 3);
    console.log("Matched players:", [player1, player2, player3]);

    // Create match
    await createMatch(io, player1, player2, player3, waitingPlayers);
  }
}


// Helper function to disconnect a player with a message
async function disconnectPlayer(playerData, io, message) {
  const playerSocket = io.sockets.sockets.get(playerData?.socketId);
  if (playerSocket) {
    playerSocket.emit("disconnectMessage", message);
    playerSocket.disconnect();
  }
}

// Function to create a match and setup a room for both players
async function createMatch(io, player1, player2, player3, waitingPlayers) {
  const roomCode = `room-${Math.random().toString(36).substr(2, 9)}`;
  const sockets = [player1, player2, player3].map((player) =>
    io.sockets.sockets.get(player.socketId)
  );

  if (sockets.every((socket) => socket)) {
    // Add players to the room
    sockets.forEach((socket) => socket.join(roomCode));
    console.log("Room created:", roomCode);
    // Fetch initial game questions
    const playerIds = [player1?.playerId, player2?.playerId, player3?.playerId];
    const playerQuestions = await getFirstGameQuestions({
      playerIds, // Pass the array of player IDs
      level: player1?.level, // Assume both players are on the same level
      questionCount: 10,
      roomCode: roomCode,
      gametype: "multiple",
    });
    console.log('playerQuestions ------------> ', playerQuestions);

    // Handle the results
    playerQuestions.forEach((result) => {
      if (result.error) {
        console.error(`Error for Player ${result?.playerId}: ${result?.error}`);
      } else {
        console.log(`Questions for Player ${result?.playerId}:`, result?.questions);
      }
    });
    // Notify players
    io.to(roomCode).emit("startGame", { roomCode });
    io.to(roomCode).emit("playersReady", {
      player1Id: player1.playerId,
      player2Id: player2.playerId,
      player3Id: player3.playerId,
    });

    // Setup disconnection listeners
    sockets.forEach((socket, index) => {
      socket.on("disconnect", () => {
        const remainingPlayers = [player1, player2, player3].filter(
          (_, i) => i !== index
        );
        handlePlayerExit(
          [player1, player2, player3][index],
          remainingPlayers,
          io,
          waitingPlayers
        );
      });
    });
  } else {
    console.error("One or more player sockets not found");
  }
}

// Function to handle when a player exits or disconnects
async function handlePlayerExit(disconnectedPlayer, remainingPlayers, io, waitingPlayers) {
  console.log(`Player ${disconnectedPlayer.playerId} disconnected.`);
  console.log("Remaining players:", remainingPlayers);

  // Notify remaining players and return them to the queue
  for (const remainingPlayer of remainingPlayers) {
    const remainingSocket = io.sockets.sockets.get(remainingPlayer.socketId);
    if (remainingSocket) {
      remainingSocket.emit("disconnectMessage", {
        message: `Player ${disconnectedPlayer.playerId} has disconnected. You will be returned to the queue to find a new match.`,
      });
      waitingPlayers.push({
        playerId: remainingPlayer.playerId,
        socketId: remainingPlayer.socketId,
        level: remainingPlayer.level,
      });
      remainingSocket.leave(disconnectedPlayer.roomCode);
    }
  }
}

// Function to check for inactive players (waiting for more than 2 minutes)
async function checkInactivePlayers(waitingPlayers, io) {
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

// Export named functions and default handler explicitly
module.exports = {
  // socketHandler, // Default function
  joinQueue,
  checkInactivePlayers,
  matchPlayers,
};
