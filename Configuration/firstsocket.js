const Player = require("../model/Player.model");
const { getFirstGameQuestions } = require("./comman");

async function joinQueue(socket, levelGroups, io, playerId, level) {
  const playerData = {
    socketId: socket.id,
    playerId,
    timestamp: Date.now(),
    level,
    status: "WAITING",
  };

  if (!levelGroups[level]) {
    levelGroups[level] = [];
  }

  const player = await Player.findById(playerId);
  if (!player) {
    socket.emit("disconnectMessage", "Player not found.");
    socket.disconnect();
    return;
  }
  if (player.userType !== "active") {
    socket.emit(
      "disconnectMessage",
      "You are inactive and cannot join the queue."
    );
    socket.disconnect();
    return;
  }

  const isAlreadyInQueue = levelGroups[level].some(
    (p) => p.playerId === playerId
  );
  if (isAlreadyInQueue) {
    socket.emit("errorMessage", "You are already in the queue for this level.");
    return;
  }

  if (levelGroups[level]?.length >= 3) {
    socket.emit("errorMessage", "The queue for this level is full.");
    return;
  }

  levelGroups[level].push(playerData);
  updatePlayersStatus(io, levelGroups[level]);
  matchPlayers(levelGroups[level], io, level);

  setTimeout(() => {
    const index = levelGroups[level].findIndex((p) => p.playerId === playerId);
    if (index !== -1) {
      levelGroups[level].splice(index, 1);
      socket.emit("disconnectMessage", "You waited too long, no match found.");
      socket.disconnect();
    }
  }, 2 * 60 * 1000);
}

async function updatePlayersStatus(io, players) {
  const playerDetails = await Promise.all(
    players.map(async (p) => {
      const playerInfo = await Player.findById(p.playerId);
      return {
        id: p?.playerId,
        status: "READY",
        firstName: playerInfo?.firstName || "Unknown",
        Lastname: playerInfo?.lastName || "Unknown",
        avatar: playerInfo?.avatar || null,
        level: p?.level,
      };
    })
  );

  io.emit("playersStatus", playerDetails);
}

async function matchPlayers(waitingPlayers, io) {
  while (waitingPlayers.length >= 3) {
    const [player1, player2, player3] = waitingPlayers.splice(0, 3);
    await createMatch(io, player1, player2, player3, waitingPlayers);
  }
}

async function createMatch(io, player1, player2, player3, waitingPlayers) {
  const roomCode = `room-${Math.random().toString(36).substr(2, 9)}`;
  const sockets = [player1, player2, player3].map((player) =>
    io.sockets.sockets.get(player.socketId)
  );

  if (sockets.every((socket) => socket)) {
    sockets.forEach((socket) => socket.join(roomCode));
    const playerIds = [player1.playerId, player2.playerId, player3.playerId];
    const questions = await getFirstGameQuestions({
      playerIds,
      level: player1.level,
      questionCount: 10,
      roomCode,
      gametype: "multiple",
    });

    const playerDetails = await Promise.all(
      [player1, player2, player3].map(async (player) => {
        const playerInfo = await Player.findById(player.playerId);
        return {
          id: player?.playerId,
          status: "READY",
          firstName: playerInfo?.firstName || "Unknown",
          LastName: playerInfo?.lastName || "Unknown",
          avatar: playerInfo?.avatar || null,
          level: player?.level,
        };
      })
    );

    io.to(roomCode).emit("playersReady", playerDetails);
    io.to(roomCode).emit("startGame", { roomCode });
    [player1, player2, player3].forEach((player) => (player.status = "READY"));

    startQuestionTimer(io, roomCode, questions, [
      { ...player1, firstName: playerDetails[0].firstName, Lastname: playerDetails[0].LastName, avatar: playerDetails[0].avatar },
      { ...player2, firstName: playerDetails[1].firstName, Lastname: playerDetails[0].LastName, avatar: playerDetails[1].avatar },
      { ...player3, firstName: playerDetails[2].firstName, Lastname: playerDetails[0].LastName, avatar: playerDetails[2].avatar },
    ]);

    sockets.forEach((socket, index) => {
      socket.on("disconnect", () => {
        handlePlayerExit(
          [player1, player2, player3][index],
          [player1, player2, player3].filter((_, i) => i !== index),
          io,
          waitingPlayers
        );
      });
    });
  } else {
    console.error("One or more player sockets not found");
  }
}

async function startQuestionTimer(io, roomCode, questions, players) {
  if (!questions?.[0]?.questions || questions[0].questions.length === 0) {
    console.error("No questions available to send.");
    return;
  }

  const que = questions[0].questions;
  let currentQuestionIndex = 0;
  const questionDuration = 3 * 60 * 1000;
  let questionTimer = null;
  let questionStartTime = Date.now();

  const playerStates = players.reduce((acc, player) => {
    acc[player.playerId] = {
      answered: false,
      answer: null,
      timeLeft: questionDuration / 1000,
    };
    return acc;
  }, {});

  function sendNextQuestion() {
    if (currentQuestionIndex >= que.length) {
      clearInterval(questionTimer);
      io.to(roomCode).emit("gameOver", { message: "Game completed!" });
      return;
    }

    const question = que[currentQuestionIndex];
    console.log(`Sending question ${currentQuestionIndex + 1}/${que.length}:`, question);

    Object.keys(playerStates).forEach((playerId) => {
      playerStates[playerId].answered = false;
      playerStates[playerId].answer = null;
      playerStates[playerId].timeLeft = questionDuration / 1000;
    });

    questionStartTime = Date.now();
    players.forEach((player) => {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        playerSocket.emit("joinRoom", { roomCode });
      } else {
        console.error(`Socket not found for player: ${player.playerId}`);
      }
    });

    io.to(roomCode).emit("newQuestion", {
      question,
      remainingTime: questionDuration / 1000,
    });
    broadcastPlayerStates();
    currentQuestionIndex++;
  }

  function broadcastPlayerStates() {
    const currentQuestion = que[currentQuestionIndex] || {};
    const playerDetails = players.map((player) => ({
      playerId: player.playerId,
      firstName: player.firstName,
      Lastname: player.lastname,
      avatar: player.avatar,
      answered: playerStates[player.playerId].answered,
      timeLeft: playerStates[player.playerId].timeLeft,
      currentQuestionId: currentQuestion.questionId || null,
      currentQuestionContent: currentQuestion.question || null,
    }));

    io.to(roomCode).emit("playerStates", playerDetails);
  }

  function checkAllAnswered() {
    return Object.values(playerStates).every((state) => state.answered);
  }

  function evaluateQuestion() {
    const results = players.map((player) => ({
      playerId: player.playerId,
      firstName: player.firstName,
      Lastname: player.lastname,
      answer: playerStates[player.playerId].answer,
      answered: playerStates[player.playerId].answered,
    }));
    io.to(roomCode).emit("questionResults", results);
  }

  function handleAnswer(playerId, answer) {
    if (!playerStates[playerId] || playerStates[playerId].answered) return;

    playerStates[playerId].answered = true;
    playerStates[playerId].answer = answer;
    broadcastPlayerStates();

    if (checkAllAnswered()) {
      clearTimeout(questionTimer); // Stop the timer early
      evaluateQuestion();
      setTimeout(sendNextQuestion, 3000); // Delay before sending the next question
    }
  }

  questionTimer = setInterval(() => {
    const elapsedTime = Date.now() - questionStartTime;
    const remainingTime = Math.max(0, questionDuration - elapsedTime);

    Object.keys(playerStates).forEach((playerId) => {
      if (!playerStates[playerId].answered) {
        playerStates[playerId].timeLeft = Math.ceil(remainingTime / 1000);
      }
    });

    broadcastPlayerStates();

    if (remainingTime <= 0) {
      clearTimeout(questionTimer);
      evaluateQuestion();
      setTimeout(sendNextQuestion, 3000);
    }
  }, 1000);

  sendNextQuestion(); // Start with the first question

  // Listen for answers from players
  players.forEach((player) => {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.on("answer", (data) => {
        console.log(`Player ${player.playerId} answered:`, data);
        handleAnswer(player.playerId, data.answer);
      });
    }
  });
}

function handleLeaveQueue(socket, levelGroups) {
  socket.on("leaveQueue", ({ playerId }) => {
    for (const level in levelGroups) {
      const index = levelGroups[level].findIndex((p) => p.playerId === playerId);
      if (index !== -1) {
        levelGroups[level].splice(index, 1); // Remove player from the queue
        console.log(`Player ${playerId} left the queue.`);
        socket.emit("disconnectMessage", "You have left the queue.");
        return;
      }
    }
    console.log(`Player ${playerId} was not found in any queue.`);
  });
}


async function handlePlayerExit(
  disconnectedPlayer,
  remainingPlayers,
  io,
  waitingPlayers
) {
  console.log(`Player ${disconnectedPlayer.playerId} disconnected.`);
  console.log("Remaining players:", remainingPlayers);

  for (const remainingPlayer of remainingPlayers) {
    const remainingSocket = io.sockets.sockets.get(remainingPlayer.socketId);
    if (remainingSocket) {
      remainingSocket.emit("disconnectMessage", {
        message: `Player ${disconnectedPlayer.playerId} has disconnected. You will be returned to the queue to find a new match.`,
      });
      waitingPlayers.push({
        ...remainingPlayer,
        status: "WAITING",
        timestamp: Date.now(),
      });
      remainingSocket.leave(disconnectedPlayer.roomCode);
    }
  }
}

async function checkInactivePlayers(waitingPlayers, io) {
  const currentTime = Date.now();
  waitingPlayers.forEach((player, index) => {
    const waitTime = currentTime - player.timestamp;
    if (waitTime > 2 * 60 * 1000) {
      waitingPlayers.splice(index, 1);
      const socket = io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.emit(
          "disconnectMessage",
          "You waited too long, no match found."
        );
        socket.disconnect();
      }
    }
  });
}

module.exports = {
  joinQueue,
  checkInactivePlayers,
  matchPlayers,
  handleLeaveQueue,
};
