const Player = require("../model/Player.model");
const { getThirdGameQuestions } = require("./comman");
const thirdQuestion = require("../model/thirdGame/meetQuestion.model");


// Function to add a player to the queue and attempt matchmaking
async function eventFormeet(socket, MeetGroups, io, playerId, role) {
  const playerData = {
    socketId: socket.id,
    playerId,
    timestamp: Date.now(),
    role
  };
  console.log(playerData, 'playerData');

  // Avoid duplicate entries with the same role in the same group
  const isPlayerAlreadyInGroup = MeetGroups.some(
    (p) => p.playerId === playerId
  );
  console.log(isPlayerAlreadyInGroup, 'isPlayerAlreadyInGroup');

  if (isPlayerAlreadyInGroup) {
    socket.emit("errorMessage", "You are already in the queue for this group.");
    return;
  }

  // Check if the same role exists in the group, if yes, create new waiting array
  const sameRolePlayer = MeetGroups.some(
    (p) => p.role === role
  );

  // Create a new waiting array if same role found, else add to the current group
  let newWaitingArray = [];
  if (sameRolePlayer) {
    console.log('Same role found, creating a new waiting array.');
    newWaitingArray.push(playerData); // Add player to the new waiting array
    socket.emit("errorMessage", "Players with the same role are already in the group. You are placed in a new queue.");
  } else {
    // Add player to the existing group
    MeetGroups.push(playerData);
  }

  // Emit updated players status
  updatePlayersStatus(io, MeetGroups);

  // Proceed with matchmaking for the updated group
  matchPlayers(MeetGroups, io, newWaitingArray);

  // Handle 2-minute timeout for matchmaking
  setTimeout(() => {
    const playerIndex = MeetGroups.findIndex(
      (p) => p.playerId === playerId
    );
    if (playerIndex !== -1) {
      MeetGroups.splice(playerIndex, 1); // Remove player from group
      socket.emit("disconnectMessage", "You waited too long, no match found.");
      socket.disconnect();
    }
  }, 2 * 60 * 1000);
}

async function updatePlayersStatus(io, players) {
  console.log(players, "players");

  // Fetch additional information for all players
  const playerDetails = await Promise.all(
    players.map(async (p) => {
      const playerInfo = await Player.findById(p.playerId);
      return {
        id: p?.playerId,
        status: "ready",
        role: p?.role,
        firstName: playerInfo?.firstName || "Unknown",
        lastName: playerInfo?.lastName || "Unknown",
        avatar: playerInfo?.avatar || null,
      };
    })
  );
  console.log(playerDetails, "playerDetails");

  // Emit the updated player details
  io.emit("playersStatus", playerDetails);
}

// Function to match players and handle pairing different roles
async function matchPlayers(waitingPlayers, io, newWaitingArray) {
  console.log("Waiting players:", waitingPlayers);

  // Merge the new waiting array with the current queue
  if (newWaitingArray.length > 0) {
    waitingPlayers = [...waitingPlayers, ...newWaitingArray];
  }

  // Match in groups of 4 players
  while (waitingPlayers.length >= 4) {

    // Try to pair players with different roles
    const matchedPlayers = [];
    let roleCount = {};

    // Loop through the players and ensure roles are unique
    for (let i = 0; i < waitingPlayers.length; i++) {
      const player = waitingPlayers[i];
      if (!roleCount[player.role]) {
        roleCount[player.role] = 0;
      }
      if (roleCount[player.role] < 1 && matchedPlayers.length < 4) {
        matchedPlayers.push(player);
        roleCount[player.role]++;
      }

      if (matchedPlayers.length === 4) {
        break;
      }
    }

    // If 4 unique role players are found, form a match
    if (matchedPlayers.length === 4) {
      console.log("Matched players:", matchedPlayers);

      // Remove the matched players from the waiting list
      matchedPlayers.forEach(player => {
        const index = waitingPlayers.findIndex(p => p.playerId === player.playerId);
        if (index !== -1) waitingPlayers.splice(index, 1);
      });

      // Create a match with the matched players
      await createMatch(io, matchedPlayers, waitingPlayers);
    } else {
      console.log("Not enough unique role players to match.");
      break;
    }
  }
}

// Function to create a match and setup a room for players
async function createMatch(io, matchedPlayers, waitingPlayers) {
  const roomCode = `room-${Math.random().toString(36).substr(2, 9)}`;
  const sockets = matchedPlayers.map((player) =>
    io.sockets.sockets.get(player.socketId)
  );

  if (sockets.every((socket) => socket)) {
    // Add players to the room
    sockets.forEach((socket) => socket.join(roomCode));
    console.log("Room created:", roomCode);
    // Extract playerIds
    const playerIds = matchedPlayers.map(player => player.playerId);

    const questions = await getThirdGameQuestions({
      playerIds,
      roomCode,
    });
    console.log("questions:", questions);

    // Emit player details to the room
    const playerDetails = await Promise.all(
      matchedPlayers.map(async (player) => {
        const playerInfo = await Player.findById(player.playerId);
        return {
          id: player?.playerId,
          status: "ready",
          role: player?.role,
          firstName: playerInfo?.firstName || "Unknown",
          lastName: playerInfo?.lastName || "Unknown",
          avatar: playerInfo?.avatar || null,
        };
      })
    );
    io.to(roomCode).emit("playersReady", playerDetails);

    // Notify players to start the game
    io.to(roomCode).emit("startGame", { roomCode });
    // Prepare players for the startQuestionTimer
    const playersWithDetails = matchedPlayers.map((player, index) => ({
      ...player,
      firstName: playerDetails[index]?.firstName || "Unknown",
      lastName: playerDetails[index]?.lastname || "Unknown",
      avatar: playerDetails[index]?.avatar || null,
    }));
    // Start the question timer with player details
    startQuestionmeet(io, roomCode, questions, playersWithDetails);

    // Setup disconnection listeners
    sockets.forEach((socket, index) => {
      socket.on("disconnect", () => {
        handlePlayerExit(
          matchedPlayers[index],
          matchedPlayers.filter((_, i) => i !== index),
          io,
          waitingPlayers
        );
      });
    });
  } else {
    console.error("One or more player sockets not found");
  }
}

async function startQuestionmeet(io, roomCode, questions, players) {
  console.log("Starting question timer for room:", roomCode);

  // Check if the question is available
  if (!questions?.[0]?.questionId || questions[0].questionId.length === 0) {
    console.error("No questions available to send.");
    return;
  }

  const que = questions[0].questionId;

  try {
    // Fetch the question from the database
    const question = await thirdQuestion.findById(que);

    if (question) {
      console.log("Question:", question);
      // Emit the question to the room and players data
      const socketsInRoom = await io.in(roomCode).allSockets();
      console.log("Sockets in room:", socketsInRoom);

      io.to(roomCode).emit("newQuestion", {
        question,
        players
      });

    } else {
      console.error("Question not found.");
    }
  } catch (error) {
    console.error("Error fetching question:", error);
  }

  console.log("Players:", players);
}


// Function to handle when a player exits or disconnects
async function handlePlayerExit(
  disconnectedPlayer,
  remainingPlayers,
  io,
  waitingPlayers
) {
  console.log(`Player ${disconnectedPlayer?.playerId} disconnected.`);
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
      });
      remainingSocket.leave(disconnectedPlayer.roomCode);
    }
  }
}

// Function to handle leaveQueue event
function handleLeaveMeetQueue(socket, MeetGroups, io) {
  socket.on("leavemeetQueue", ({ playerId }) => {
    console.log(`Player ${playerId} is leaving the queue.`);
    // Find and remove the player from the MeetGroups
    const playerIndex = MeetGroups.findIndex((p) => p.playerId === playerId);
    if (playerIndex !== -1) {
      const removedPlayer = MeetGroups.splice(playerIndex, 1)[0];
      console.log(`Removed player:`, removedPlayer);
      // Notify the player about successful removal
      socket.emit("disconnectMessage", "You have left the queue.");
      // Optionally notify other players about the updated queue
      updatePlayersStatus(io, MeetGroups);
    } else {
      console.log(`Player ${playerId} not found in the queue.`);
      socket.emit("errorMessage", "You are not currently in the queue.");
    }
  });
}

// Export named functions and default handler explicitly
module.exports = {
  // socketHandler, // Default function
  handleLeaveMeetQueue,
  eventFormeet,
  matchPlayers,
};
