const MeetGamesession = require("../../model/thirdGame/meetSession.model");
const Question = require("../../model/FirstGame/multipleQuestion.model");
const Player = require("../../model/Player.model");
const Level = require("../../model/Level.model");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");
const { default: mongoose } = require("mongoose");

// Get result for a specific level
module.exports.joinmeetGame = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;

  try {
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    // Find or create a game session for the player
    let sessionPlayer = await MeetGamesession.findOne({ playerId });
    if (!sessionPlayer) {
      sessionPlayer = await MeetGamesession.create({ playerId });
    }
    return res.json(playerId);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: "Failed to join the game. Please try again later." });
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
      const sessionWithCompletedLevel = await MeetGamesession.findOne({
        playerId,
        completedLevels: levelData._id,
      });
      if (sessionWithCompletedLevel) {
        return res
          .status(400)
          .json({ message: "You have already completed this level." });
      }

      // Retrieve or create a game session
      let MeetGamesession = await MeetGamesession.findOne({ playerId });
      if (!MeetGamesession) {
        MeetGamesession = await MeetGamesession.create({ playerId });
      }

      // Check for existing level data in session
      let levelScoreData = MeetGamesession.levelScores.find(
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
          MeetGamesession.levelScores.push({
            level: new mongoose.Types.ObjectId(levelData._id), // Convert to ObjectId,
            score: 0,
            questions: formattedQuestions,
          });
          MeetGamesession.currentLevel = level;
        }

        await MeetGamesession.save();
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

  try {
    const getLevel = await Level.findOne({ levelNumber: level });
    if (!getLevel) return res.status(404).json({ error: "Level not found" });
    const player = await MeetGamesession.findOne({ playerId });
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
      if (index == 9) {
        // Mark the level as completed if not already in completedLevels
        if (!player.completedLevels.includes(getLevel._id)) {
          player.completedLevels.push(getLevel._id);
          player.currentLevel = level;
        }
      }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid index or question does not exist" });
    }

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
    const player = await MeetGamesession.findOne({ playerId });
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
    const playerSession = await MeetGamesession.aggregate([
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
    const session = await MeetGamesession.findOne({ playerId });

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
