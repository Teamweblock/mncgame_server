const Gamesession = require("../model/FirstGame/firstgameSession.model");
const Question = require("../model/FirstGame/firstgameQuestion.model");
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
      { $match: { level: levelData._id } },
      { $sample: { size: questionCount } },
    ]);

    if (!questions || questions.length === 0) {
      throw new Error("No questions found for this level.");
    }

    const formattedQuestions = questions.map((question) => ({
      questionId: question._id,
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
        completedLevels: levelData._id,
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
        (score) => score.level.toString() === levelData._id.toString()
      );

      if (!levelScoreData) {
        // Add a new level entry for the player
        gameSession.levelScores.push({
          level: new mongoose.Types.ObjectId(levelData._id),
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

// const getFirstGameQuestions = async ({
//   playerId,
//   level,
//   questionCount,
//   gametype,
//   roomCode,
// }) => {
//   // Find level by level number
//   const levelData = await Level.findOne({ levelNumber: level });
//   if (!levelData) {
//     throw new Error("Level not found.");
//   }

//   // Check if the player already completed this level
//   const sessionWithCompletedLevel = await Gamesession.findOne({
//     playerId,
//     completedLevels: levelData._id,
//   });
//   if (sessionWithCompletedLevel) {
//     throw new Error("You have already completed this level.");
//   }

//   // Retrieve or create session
//   let gameSession = await Gamesession.findOne({ playerId });
//   if (!gameSession) {
//     gameSession = await Gamesession.create({ playerId });
//   }

//   // Check if level-specific questions are already in session
//   let levelScoreData = gameSession.levelScores.find(
//     (score) => score.level.toString() === levelData._id.toString()
//   );

//   let questions;
//   if (
//     levelScoreData &&
//     levelScoreData.questions.length >= (questionCount || 10)
//   ) {
//     questions = await Question.aggregate([
//       {
//         $match: {
//           _id: { $in: levelScoreData.questions.map((q) => q.questionId) },
//         },
//       },
//       // {
//       //   $project: {
//       //     questionId: "$_id",
//       //     questionText: "$questionText",
//       //     answer: { $literal: null },
//       //     score: { $literal: 0 },
//       //   },
//       // },
//       {
//         $project: {
//           questionId: {
//             _id: "$_id",
//             questionText: "$questionText",
//             correctOptions: "$correctOptions",
//             level: "$level",
//             // Add any additional fields from your schema here
//           },
//           questionText: "$questionText",
//           answer: { $literal: null },
//           score: { $literal: 0 },
//         },
//       },
//     ]);
//   } else {
//     // Fetch new questions if needed
//     questions = await Question.aggregate([
//       { $match: { level: levelData._id } },
//       { $sample: { size: questionCount || 10 } },
//     ]);

//     // Handle case where no questions are found
//     if (questions.length === 0) {
//       throw new Error("No questions found for this level.");
//     }

//     const formattedQuestions = questions.map((question) => ({
//       questionId: question,
//       answer: null,
//       score: 0,
//     }));

//     if (levelScoreData) {
//       levelScoreData.questions = formattedQuestions;
//     } else {
//       gameSession.levelScores.push({
//         level: levelData._id,
//         score: 0,
//         questions: formattedQuestions,
//       });
//     }
//     await gameSession.save();
//   }

//   // Return formatted questions with question text
//   return questions.map((question) => ({
//     questionId: question,
//     questionText: question.questionText,
//     answer: null,
//     score: 0,
//   }));
// };

module.exports = {
  getFirstGameQuestions,
};
