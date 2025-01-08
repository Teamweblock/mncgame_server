const Gamesession = require("../../model/FirstGame/multipleSession.model");
const Player = require("../../model/Player.model");
const Level = require("../../model/Level.model");
const Question = require("../../model/FirstGame/multipleQuestion.model");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");
const { default: mongoose } = require("mongoose");

// calculate Score
function calculateScore(correctAnswer, userAnswer) {
  // Normalize both answers: trim, convert to lowercase, and remove punctuation
  const normalizeText = (text) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ""); // Remove punctuation (except spaces)

  const normalizedCorrectAnswer = normalizeText(correctAnswer);
  const normalizedUserAnswer = normalizeText(userAnswer);

  // Split both answers into words (handle multiple spaces and common separators)
  const correctWords = normalizedCorrectAnswer.split(/\s+/); // Split by whitespace
  const userWords = normalizedUserAnswer.split(/\s+/); // Split by whitespace

  // Count the number of matching words
  let matchingWords = 0;

  userWords.forEach((userWord) => {
    if (correctWords.includes(userWord)) {
      matchingWords++;
    }
  });

  // Calculate the match percentage
  const matchPercentage = (matchingWords / correctWords.length) * 100;

  // Assign a score based on the percentage (adjust thresholds as needed)
  let score = 0;
  if (matchPercentage === 100) {
    score = 100; // Perfect match
  } else if (matchPercentage >= 80) {
    score = 90; // High match
  } else if (matchPercentage >= 60) {
    score = 80; // Medium match
  } else if (matchPercentage >= 40) {
    score = 70; // Low match
  } else if (matchPercentage >= 20) {
    score = 50; // Very low match
  } else {
    score = 0; // No match
  }

  // Return the match percentage and score
  return { matchPercentage, score };
}

// Get result for a specific level
module.exports.joinmultipleGame = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  const { level } = req.body;

  try {
    const getLevel = await Level.findOne({ levelNumber: level });
    if (!getLevel) return res.status(404).json({ error: "Level not found" });
    await Gamesession.findOneAndUpdate(
      { playerId },
      { $setOnInsert: { playerId } },
      { upsert: true, new: true }
    );

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    player.userType = "active";
    await player.save();

    return res.json(playerId);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Failed to join the game. Please try again later." });
  }
});

// create gameSessions
module.exports.creatgameSession = catchAsyncErrors(async (req, res, next) => {
  const { playerId } = req.body;
  const gameSessions = await Gamesession.create({
    playerId,
  });

  if (!gameSessions) {
    return next(new ErrorHander("gameSessions cannot be created...", 404));
  }

  res.status(200).json({
    success: true,
    gameSessions,
    // result
  });
});

//get all gameSessions
module.exports.getallgameSessions = catchAsyncErrors(async (req, res, next) => {
  try {
    const gameSessions = await Gamesession.find().populate(
      "playerId completedLevels"
    );

    res.status(200).json({
      success: true,
      gameSessions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch gameSessions" });
  }
});

//getsinglegameSessions
module.exports.getsinglegameSessions = catchAsyncErrors(
  async (req, res, next) => {
    let id = req.query.id;

    const gameSessions = await Gamesession.find({ _id: id });

    if (!gameSessions) {
      return next(new ErrorHander("gameSessions not found", 404));
    } else {
      res.status(200).json({
        success: true,
        gameSessions,
      });
    }
  }
);

//Delete Gamesession
module.exports.deletegameSession = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const data = await Gamesession.findByIdAndDelete(id);
    if (!data) {
      return next(new ErrorHander("gameSessions not found", 404));
    }
    return res
      .status(200)
      .json({ message: "gameSessions deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update Gamesession
module.exports.updategameSessions = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { currentLevel, completedLevels } = req.body;
  let gameSessions = await Gamesession.findById(id);

  if (!gameSessions) {
    return next(new ErrorHander("Cannot found gameSessions..", 404));
  }
  try {
    const updatedgameSession = await Gamesession.findByIdAndUpdate(
      id,
      {
        currentLevel,
        completedLevels,
      },
      { new: true }
    );

    if (!updatedgameSession) {
      return res.status(404).json({ message: "Gamesession not found" });
    }

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updatedgameSession,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update Gamesession" });
  }
});

//check Valid level
module.exports.getmultiLevelAccess = catchAsyncErrors(async (req, res, next) => {
  const { level, playerType } = req.body;
  const user = req.user;
  const playerId = user?._id;

  try {
    // Step 1: Find the player
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: "Player not found." });

    // Step 2: Find the level data
    const levelData = await Level.findOne({ levelNumber: level });
    if (!levelData) return res.status(404).json({ error: "Level not found." });

    // Step 3: Check if the player has already completed this level
    const completedLevelSession = await Gamesession.findOne({
      playerId,
      completedLevels: levelData._id,
    });

    if (completedLevelSession) {
      return res
        .status(400)
        .json({ message: "You have already completed this level." });
    }

    // Step 4: Handle the flow for multiplayer (paid or free)
    if (playerType === "multiple") {
      // Find or create a game session for the player
      let sessionPlayer = await Gamesession.findOne({ playerId });
      if (!sessionPlayer) {
        sessionPlayer = await Gamesession.create({ playerId });
      }

      // Ensure the player is active
      if (player.userType !== "active") {
        player.userType = "active";
        await player.save();
      }
    }

    // Step 5: Default response for single-player mode or other scenarios
    return res.status(200).json({
      message: "You have started the game.",
      playerId: playerId,
    });
  } catch (err) {
    // Step 6: Error handling
    console.error("Error in getLevelAccess:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// get Questions For Level
module.exports.getQuestionsFormultipleLevel = catchAsyncErrors(
  async (req, res, next) => {
    const { level } = req.body;
    const user = req.user;
    const playerId = user._id;
    const questionCount = parseInt(req.query.count) || 10;

    try {
      // Find Player
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found." });
      }

      // Find Level
      const levelData = await Level.findOne({ levelNumber: level });
      if (!levelData) {
        return res.status(404).json({ error: "Level not found." });
      }

      // Check if the level is already completed
      const sessionWithCompletedLevel = await Gamesession.findOne({
        playerId,
        completedLevels: levelData._id,
      });
      if (sessionWithCompletedLevel) {
        return res
          .status(400)
          .json({ message: "You have already completed this level." });
      }

      // Retrieve or create a game session
      let gameSession = await Gamesession.findOne({ playerId });
      if (!gameSession) {
        gameSession = await Gamesession.create({ playerId });
      }

      // Check for existing level data in session
      let levelScoreData = gameSession.levelScores.find(
        (score) => score.level.toString() === levelData._id.toString()
      );

      let questions;
      if (
        levelScoreData &&
        levelScoreData.questions.length >= (questionCount || 10)
      ) {
        questions = await Question.aggregate([
          {
            $match: {
              _id: { $in: levelScoreData.questions.map((q) => q.questionId) },
            },
          },
          {
            $project: {
              questionId: {
                _id: "$_id",
                question: "$question",
                correctOptions: "$correctOptions",
                level: "$level",
                // Add any additional fields from your schema here
              },
              question: "$question",
              answer: { $literal: null },
              score: { $literal: 0 },
            },
          },
        ]);
      } else {
        // Fetch new questions if needed
        questions = await Question.aggregate([
          { $match: { level: levelData._id } },
          { $sample: { size: questionCount || 10 } },
        ]);

        // Handle case where no questions are found
        if (questions?.length === 0) {
          return res
            .status(404)
            .json({ error: "No questions found for this level." });
        }

        const formattedQuestions = questions.map((question) => ({
          questionId: question,
          answer: null,
          score: 0,
        }));

        if (levelScoreData) {
          levelScoreData.questions = formattedQuestions;
        } else {
          gameSession.levelScores.push({
            level: new mongoose.Types.ObjectId(levelData._id), // Convert to ObjectId,
            score: 0,
            questions: formattedQuestions,
          });
          gameSession.currentLevel = level;
        }

        await gameSession.save();
      }
      // Return formatted questions with question text
      const formattedQuestions = levelScoreData?.questions
        .map((storedQuestion) => {
          // Find the matching question from the database
          return questions.find(
            (question) =>
              question._id.toString() === storedQuestion.questionId.toString()
          );
        })
        .filter(Boolean); // Remove any null values if no match is found

      return res.status(200).json({
        formattedQuestions,
        status: true,
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      return res.status(500).json({ error: "Failed to fetch questions." });
    }
  }
);

// Submit answers for a level
module.exports.submitMultiAnswer = catchAsyncErrors(async (req, res, next) => {
  const { level, answers, questionId, index } = req.body;
  const user = req.user;
  const playerId = user._id;
  console.log("req.body -----------------> ", req.body);

  try {
    const getLevel = await Level.findOne({ levelNumber: level });
    if (!getLevel) return res.status(404).json({ error: "Level not found" });
    const player = await Gamesession.findOne({ playerId });
    if (!player) return res.status(404).json({ error: "Player not found" });

    // Find if the level already exists in the player's levelScores
    const existingLevel = player.levelScores.find(
      (ls) => ls.level.toString() === getLevel._id.toString()
    );

    if (existingLevel && existingLevel.questions[index]) {
      const questionEntry = existingLevel.questions[index];

      // Check if the question ID matches the one in the current entry
      if (questionEntry?.questionId?.toString() === questionId?.toString()) {
        const question = await Question.findById(questionId);
        if (!question)
          return res.status(404).json({ error: "Question not found" });

        // Remove the score update logic here
        questionEntry.answer = answers;
      }

      // Special case for index 9: Do not calculate average score
      // if (index == 9) {
      //   // Mark the level as completed if not already in completedLevels
      //   if (!player.completedLevels.includes(getLevel._id)) {
      //     player.completedLevels.push(getLevel._id);
      //     player.currentLevel = level;
      //   }
      // }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid index or question does not exist" });
    }
    console.log("player -----------------> ", player);

    // Save player data after updating
    await player.save();

    res.status(200).json({ success: true, error: false, player });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).json({ error: "Failed to submit answers." });
  }
});

module.exports.getplayerResult = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  const { level } = req.body;

  try {
    // Find the player
    const player = await Gamesession.findOne({ playerId });
    if (!player) return res.status(404).json({ error: "Player not found" });
    const getLevel = await Level.findOne({ levelNumber: level });

    // Filter the specific level score
    const levelScore = player.levelScores.find(
      (score) => score.level.toString() === getLevel?._id.toString()
    );

    if (!levelScore) {
      return res.status(404).json({ error: "Level score not found" });
    }

    // Create a response with only the filtered level score
    const response = {
      ...player._doc, // Include other player properties
      levelScores: [levelScore], // Only include the filtered level score
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching level score:", error);
    res.status(500).json({ error: "Failed to fetch level score." });
  }
});

module.exports.overallPerformance = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;

  try {
    const playerSession = await Gamesession.aggregate([
      { $match: { playerId: new mongoose.Types.ObjectId(playerId) } }, // Find the player's session
      { $unwind: "$levelScores" }, // Unwind the levelScores array to process each entry
      {
        $project: {
          "levelScores.score": 1, // Get the score for each level
          "levelScores.level": 1, // Get the level reference
        },
      },
      {
        $group: {                 
          _id: "$playerId", // Group by playerId
          totalScore: { $sum: "$levelScores.score" }, // Sum all scores
          levelCount: { $sum: 1 }, // Count the number of levels played
          levelScores: { $push: "$levelScores" }, // Push level scores into an array
        },
      },
    ]);

    if (playerSession.length > 0) {
      const playerData = playerSession[0];
      const totalScore = playerData.totalScore;
      const levelCount = playerData.levelCount;

      // You can now calculate the overall score percentage
      const overallScorePercentage = (totalScore / (levelCount * 100)) * 100; // Assuming max score per level is 100

      return res.json({
        levelScores: playerData.levelScores, // Array of level scores
        overallScorePercentage: overallScorePercentage.toFixed(2), // Overall score percentage
      });
    } else {
      return res.status(404).json({ error: "Player session not found." });
    }
  } catch (error) {
    return res.status(500).json({
      error:
        "Failed to get particular player's overall performance. Please try again later.",
    });
  }
});

// API Endpoint to Update Progress
module.exports.updateProgress = catchAsyncErrors(async (req, res) => {
  const { playerId, levelId, questionId, score } = req.body;

  // Validate inputs
  if (!playerId || !levelId || !questionId || typeof score !== "number") {
    return res.status(400).json({ message: "Invalid input parameters." });
  }

  try {
    // Find the session for the player
    const session = await Gamesession.findOne({ playerId });

    if (!session) {
      return res.status(404).json({ message: "Player session not found." });
    }

    // Find the levelScores entry for the specific level
    const levelScore = session.levelScores.find(
      (ls) => ls.level.toString() === levelId
    );

    if (!levelScore) {
      return res.status(404).json({ message: "Level not found in session." });
    }

    // Find the specific question and update the score
    const question = levelScore.questions.find(
      (q) => q.questionId.toString() === questionId
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found in level." });
    }

    question.score = score;

    // Save the updated session
    await session.save();

    res.status(200).json({
      message: "Score updated successfully.",
      data: session,
    });
  } catch (error) {
    console.error("Error updating score:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});
