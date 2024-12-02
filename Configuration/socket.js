const Gamesession = require("../model/FirstGame/firstgameSession.model");
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

  // Check if player exists and is active
  const player = await Player.findById(playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  if (player?.userType !== "active") {
    socket.emit(
      "disconnectMessage",
      "You are inactive and cannot join the queue."
    );
    socket.disconnect();
    return;
  }

  // Add player to the appropriate level group
  if (!levelGroups[level]) {
    levelGroups[level] = []; // Create a new group for this level if not exists
  }

  const isPlayerAlreadyInGroup = levelGroups[level].some(
    (existingPlayer) => existingPlayer?.playerId === playerId
  );

  if (!isPlayerAlreadyInGroup) {
    levelGroups[level].push(playerData);
    console.log(`Player added to level ${level} group:`, playerData);
  } else {
    console.log(`Player already in the level ${level} group:`, playerData);
  }

  // Try to find a match for the current level group
  matchPlayers(levelGroups[level], io, level);

  // Set a timeout to disconnect the player if no match is found within 2 minutes
  setTimeout(() => {
    const playerIndex = levelGroups[level]?.indexOf(playerData);
    if (playerIndex > -1) {
      levelGroups[level].splice(playerIndex, 1); // Remove from the group
      socket.emit("disconnectMessage", "You waited too long, no match found.");
      socket.disconnect();
    }
    // Clean up empty level groups
    if (levelGroups[level]?.length === 0) {
      delete levelGroups[level];
    }
  }, 2 * 60 * 1000); // 2-minute timeout
}

// Function to handle player matching and room creation
async function matchPlayers(waitingPlayers, io, level) {
  while (waitingPlayers.length >= 2) {
    const [player1, player2] = waitingPlayers.splice(0, 2);

    // Ensure both players are active
    const isActive1 = await Player.findById(player1.playerId);
    const isActive2 = await Player.findById(player2.playerId);

    if (!isActive1 || isActive1?.userType !== "active") {
      disconnectPlayer(player1, io, "Inactive user cannot join.");
      continue; // Skip to the next match
    }

    if (!isActive2 || isActive2?.userType !== "active") {
      disconnectPlayer(player2, io, "Inactive user cannot join.");
      continue; // Skip to the next match
    }

    // Create the match for the two players
    await createMatch(io, player1, player2, waitingPlayers);
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
async function createMatch(io, player1, player2, waitingPlayers) {
  const roomCode = `room-${Math.random().toString(36).substr(2, 9)}`;

  const player1Socket = io.sockets.sockets.get(player1.socketId);
  const player2Socket = io.sockets.sockets.get(player2.socketId);

  if (player1Socket && player2Socket) {
    // Add players to the room
    player1Socket.join(roomCode);
    player2Socket.join(roomCode);

    // Fetch initial game questions
    const playerIds = [player1?.playerId, player2?.playerId];
    const playerQuestions = await getFirstGameQuestions({
      playerIds, // Pass the array of player IDs
      level: player1?.level, // Assume both players are on the same level
      questionCount: 10,
      roomCode: roomCode,
      gametype: "multiple",
    });

    // Handle the results
    playerQuestions.forEach((result) => {
      if (result.error) {
        console.error(`Error for Player ${result?.playerId}: ${result?.error}`);
      } else {
        console.log(`Questions for Player ${result?.playerId}:`, result?.questions);
      }
    });
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
    remainingPlayerSocket.emit("disconnectMessage", {
      message: `Player ${disconnectedPlayer.playerId} has disconnected. You will be returned to the queue to find a new match.`,
    });

    // Add the remaining player back to the waiting queue to find a new opponent
    waitingPlayers.push(remainingPlayer);
    // You can also optionally clear the room or return the disconnected player to the queue
    remainingPlayerSocket.leave(disconnectedPlayer.roomCode); // Leave the room
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

module.exports = { joinQueue, checkInactivePlayers, matchPlayers };
