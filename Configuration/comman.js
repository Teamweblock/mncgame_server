const Gamesession = require("../model/FirstGame/multipleSession.model");
const Question = require("../model/FirstGame/multipleQuestion.model");
const Player = require("../model/Player.model");
const Level = require("../model/Level.model");
const { default: mongoose } = require("mongoose");

const getFirstGameQuestions = async ({
  playerIds, // Accept an array of player IDs
  level,
  questionCount = 10, // Default to 10 questions if not provided
  roomCode,
  gametype,
}) => {
  try {
    // Find the level data
    const levelData = await Level.findOne({ levelNumber: level });
    if (!levelData) {
      throw new Error("Level not found");
    }

    // Fetch or generate shared questions for the level
    let questions = await Question.aggregate([
      { $match: { level: levelData?._id } },
      { $sample: { size: questionCount } },
    ]);

    if (!questions || questions.length === 0) {
      throw new Error("No questions found for this level.");
    }

    const formattedQuestions = questions.map((question) => ({
      questionId: question?._id,
      answer: null,
      score: 0,
    }));

    // Initialize results array
    const results = [];

    // Process each player ID
    for (const playerId of playerIds) {
      const player = await Player.findById(playerId);
      if (!player) {
        results.push({ playerId, error: "Player not found" });
        continue; // Skip this player
      }

      // Retrieve or create a game session for the player
      let gameSession = await Gamesession.findOne({ playerId });
      if (!gameSession) {
        gameSession = await Gamesession.create({ playerId });
      }

      // Check if the player already completed the level
      const sessionWithCompletedLevel = await Gamesession.findOne({
        playerId,
        completedLevels: levelData?._id,
      });
      if (sessionWithCompletedLevel) {
        results.push({
          playerId,
          error: "You have already completed this level.",
        });
        continue; // Skip this player
      }

      // Check if the level is already in the player's session
      let levelScoreData = gameSession.levelScores.find(
        (score) => score.level.toString() === levelData?._id.toString()
      );

      if (!levelScoreData) {
        // Add a new level entry for the player
        gameSession.levelScores.push({
          level: new mongoose.Types.ObjectId(levelData?._id),
          score: 0,
          isPaired: true,
          roomCode: roomCode,
          gameType: "multiple", // Example: dynamically set pairing based on gametype
          questions: formattedQuestions,
        });
        gameSession.currentLevel = level;
      } else {
        // Update existing questions for the level
        levelScoreData.questions = formattedQuestions;
      }

      await gameSession.save();
      results.push({ playerId, questions: formattedQuestions });
    }

    return results; // Return results for all players
  } catch (error) {
    console.error("Error in getFirstGameQuestions:", error.message);
    throw new Error(error?.message || "An unexpected error occurred");
  }
};

module.exports = {
  getFirstGameQuestions,
};
