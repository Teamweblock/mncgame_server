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
  console.log('waitingPlayers', waitingPlayers);

  while (waitingPlayers.length >= 3) {
    const [player1, player2, player3] = waitingPlayers.splice(0, 3);

    // Check if all players are active
    const isActivePlayers = await Promise.all([
      Player.findById(player1.playerId),
      Player.findById(player2.playerId),
      Player.findById(player3.playerId),
    ]);
    if (isActivePlayers.some((player) => !player || player.userType !== "active")) {
      // Handle inactive players and clean up
      [player1, player2, player3].forEach((player, index) => {
        if (!isActivePlayers[index] || isActivePlayers[index]?.userType !== "active") {
          disconnectPlayer(player, io, "Inactive user cannot join.");
        } else {
          waitingPlayers.push(player); // Re-add active players
        }
      });
      continue; // Skip this iteration
    }
    // Proceed to create a match
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

  const player1Socket = io.sockets.sockets.get(player1.socketId);
  const player2Socket = io.sockets.sockets.get(player2.socketId);
  const player3Socket = io.sockets.sockets.get(player3.socketId);

  if (player1Socket && player2Socket && player3Socket) {
    // Add players to the room
    player1Socket.join(roomCode);
    player2Socket.join(roomCode);
    player3Socket.join(roomCode);

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
    // Notify both players
    io.to(roomCode).emit("startGame", roomCode);
    io.to(roomCode).emit("playersReady", {
      player1Id: player1.playerId,
      player2Id: player2.playerId,
      player3Id: player3.playerId,
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
async function handlePlayerExit(disconnectedPlayer, remainingPlayers, io, waitingPlayers) {
  console.log(`Player ${disconnectedPlayer.playerId} disconnected.`);
  console.log('remainingPlayers', remainingPlayers);
  remainingPlayers.forEach((remainingPlayer) => {
    const remainingPlayerSocket = io.sockets.sockets.get(remainingPlayer.socketId);
    if (remainingPlayerSocket) {
      remainingPlayerSocket.emit("disconnectMessage", {
        message: `Player ${disconnectedPlayer?.playerId} has disconnected. You will be returned to the queue to find a new match.`,
      });
      waitingPlayers.push(remainingPlayer); // Add back to the queue
      remainingPlayerSocket.leave(disconnectedPlayer.roomCode); // Leave the room
    }
  });
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

module.exports = { joinQueue, checkInactivePlayers, matchPlayers };
