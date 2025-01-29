const mongoose = require("mongoose");
const Player = require("../model/Player.model");
const Level = require("../model/Level.model");
// Import game models
const firstQuestion = require("../model/FirstGame/multipleQuestion.model");
const thirdQuestion = require("../model/thirdGame/meetQuestion.model");
const MultipleGameSession = require("../model/FirstGame/multipleSession.model");
const SingleGameSession = require("../model/FirstGame/singleSession.model");
const SecondGameSession = require("../model/SecondGame/secondgameSession.model");
const MeetGameGameSession = require("../model/thirdGame/meetSession.model");

const validateDates = (startDate, endDate) => {
  // Check if startDate and endDate are valid ISO date strings
  if (startDate && isNaN(Date.parse(startDate))) {
    throw new Error("Invalid startDate format. Use YYYY-MM-DD.");
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    throw new Error("Invalid endDate format. Use YYYY-MM-DD.");
  }

  // Check if startDate is before endDate
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error("startDate must be earlier than or equal to endDate.");
  }
};

const getWeeklyAnalysis = async (playerId, startDate, endDate) => {
  try {

    const [
      singleGameSessions,
      multipleGameSessions,
      entrepreneurialEdgeData,
      strategyTrialData,
    ] = await Promise.all([
      SingleGameSession.find({
        playerId,
        updatedAt: { $gte: startDate, $lte: endDate },
      }),
      MultipleGameSession.find({
        playerId,
        updatedAt: { $gte: startDate, $lte: endDate },
      }),
      SecondGameSession.find({
        playerId,
        updatedAt: { $gte: startDate, $lte: endDate },
      }),
      MeetGameGameSession.find({
        playerId,
        updatedAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

    // Helper function to calculate total playtime in milliseconds
    const calculatePlaytimeForGame = (sessions) => {
      return sessions.reduce((totalPlaytime, session) => {
        return (
          totalPlaytime +
          session.levelScores.reduce((levelPlaytime, level) => {
            if (!level.timeSpent || !level.timeSpent.startTime) {
              return levelPlaytime; // Skip levels without timeSpent
            }

            const start = new Date(level.timeSpent.startTime);
            const end = level.timeSpent.endTime
              ? new Date(level.timeSpent.endTime)
              : new Date(); // Default to current time if no endTime

            return levelPlaytime + (end - start); // Difference in ms
          }, 0)
        );
      }, 0);
    };


    // Helper function to calculate total score for a game
    const calculateTotalScore = (sessions) =>
      sessions.reduce((totalScore, session) => {
        return (
          totalScore +
          session.levelScores.reduce((levelSum, level) => levelSum + level.score, 0)
        );
      }, 0);

    // Helper function to calculate total completed levels
    const calculateCompletedLevels = (sessions) =>
      sessions.reduce((totalLevels, session) => {
        return totalLevels + session.completedLevels.length;
      }, 0);

    // Combine Problem Pilot Single and Multiple Reports
    const problemPilotCombinedReport = {
      gameName: "Problem Pilot - Combined",
      totalLevelsCompleted:
        calculateCompletedLevels(singleGameSessions) +
        calculateCompletedLevels(multipleGameSessions),
      totalScore:
        calculateTotalScore(singleGameSessions) +
        calculateTotalScore(multipleGameSessions),
      totalPlayTime:
        (
          calculatePlaytimeForGame(singleGameSessions)
          +
          calculatePlaytimeForGame(multipleGameSessions)
        ) /
        60000, // Convert ms to hours
    };

    const entrepreneurialEdgeReport = {
      gameName: "Entrepreneurial Edge",
      totalLevelsCompleted: calculateCompletedLevels(entrepreneurialEdgeData),
      totalScore: calculateTotalScore(entrepreneurialEdgeData),
      totalPlayTime: calculatePlaytimeForGame(entrepreneurialEdgeData) / 3600000, // Convert ms to hours
    };

    const strategyTrialReport = {
      gameName: "Strategy Trial",
      totalScore: calculateTotalScore(strategyTrialData),
      totalPlayTime: calculatePlaytimeForGame(strategyTrialData) / 3600000, // Convert ms to hours
    };

    // Combine all reports into one
    const report = {
      playerId,
      startDate,
      endDate,
      games: [
        problemPilotCombinedReport,
        entrepreneurialEdgeReport,
        strategyTrialReport,
      ],
    };

    return report;
  } catch (error) {
    console.error("Error generating weekly analysis:", error);
    throw new Error("Failed to generate weekly analysis.");
  }
};

const fetchGameData = async (model, playerId, timeRange, startDate, endDate) => {
  // Validate timeRange
  const timeGroup = {
    monthly: { $month: "$updatedAt" },
    weekly: { $week: "$updatedAt" },
    custom: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
  }[timeRange];

  if (!timeGroup) {
    throw new Error("Invalid time range specified.");
  }

  // Build the $match stage
  const matchStage = { playerId: playerId };

  // Add date filtering if startDate and endDate are provided
  if (startDate || endDate) {
    matchStage.updatedAt = {};
    if (startDate) {
      matchStage.updatedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      matchStage.updatedAt.$lte = new Date(endDate);
    }
  }

  // Perform aggregation
  return await model.aggregate([
    { $match: matchStage },
    { $unwind: "$levelScores" },
    {
      $group: {
        _id: timeGroup,
        averageScore: { $avg: "$levelScores.score" },
      },
    },
    { $sort: { "_id": 1 } },
  ]);
};

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

    // Fetch shared questions for the level
    let questions = await firstQuestion.aggregate([
      { $match: { level: levelData._id } },
      { $sample: { size: questionCount } },
    ]);

    if (!questions || questions.length === 0) {
      throw new Error("No questions found for this level.");
    }

    const formattedQuestions = questions.map((question) => ({
      questionId: question._id,
      question: question.question, // Include the question text
      answer: null,
      score: 0,
    }));

    // Initialize results array
    const results = [];

    for (const playerId of playerIds) {
      const player = await Player.findById(playerId);
      if (!player) {
        results.push({ playerId, error: "Player not found" });
        continue; // Skip this player
      }

      // Retrieve or create a game session for the player
      let gameSession = await MultipleGameSession.findOne({ playerId });
      if (!gameSession) {
        gameSession = await MultipleGameSession.create({ playerId });
      }

      // Check if the level is already completed
      const sessionWithCompletedLevel = await MultipleGameSession.findOne({
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
          roomCode: roomCode || null,
          gameType: "multiple",
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

    console.log("results", results);
    console.log("formattedQuestions", formattedQuestions);

    return results; // Return results for all players
  } catch (error) {
    console.error("Error in getFirstGameQuestions:", error.message);
    throw new Error(error.message || "An unexpected error occurred");
  }
};

const getThirdGameQuestions = async ({
  playerData, // Accept an array of player objects containing playerId and role
  roomCode,
}) => {
  console.log("playerData", playerData);
  try {
    // Fetch all questions from the Questions model
    const allQuestions = await thirdQuestion.find();

    if (!allQuestions || allQuestions.length === 0) {
      throw new Error("No questions found.");
    }

    // Select a random question to assign to all players
    const randomQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];

    // Initialize results array
    const results = [];
    console.log("randomQuestion", randomQuestion);

    // Process each playerData which includes playerId and role
    for (const { playerId, role } of playerData) {
      const player = await Player.findById(playerId);
      if (!player) {
        results.push({ playerId, error: "Player not found" });
        continue; // Skip this player
      }

      // Retrieve or create a game session for the player
      let gameSession = await MeetGameGameSession.findOne({ playerId });
      if (!gameSession) {
        gameSession = await MeetGameGameSession.create({ playerId });
      }

      // Check if the player already has a level entry for this roomCode
      const levelScoreData = gameSession.levelScores.find(
        (code) => code.roomCode === roomCode
      );

      if (!levelScoreData) {
        // Add a new level entry for the player with role
        gameSession.role = role
        gameSession.levelScores.push({
          score: 0,
          isPaired: true,
          roomCode: roomCode,
          question: randomQuestion?._id,
        });
      } else {
        // Update existing questions for the level
        levelScoreData.question = randomQuestion?._id;
      }

      await gameSession.save();
      results.push({ playerId, questionId: randomQuestion?._id });
    }

    return results; // Return results for all players
  } catch (error) {
    console.error("Error in getThirdGameQuestions:", error.message);
    throw new Error(error?.message || "An unexpected error occurred");
  }
};



module.exports = {
  getFirstGameQuestions,
  getThirdGameQuestions,
  getWeeklyAnalysis,
  fetchGameData,
  validateDates
};
