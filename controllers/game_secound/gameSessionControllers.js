const Gamesession = require("../../model/SecondGame/secondgameSession.model");
const Player = require("../../model/Player.model");
const Level = require("../../model/Level.model");
const Question = require("../../model/SecondGame/secondgameQuestion.model");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");
const { default: mongoose } = require("mongoose");

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

// module.exports.getLevelAccess = catchAsyncErrors(async (req, res) => {
//   try {
//     const { level } = req.body;
//     const user = req.user;
//     const playerId = user._id;

//     // Find player
//     const player = await Player.findById(playerId);
//     if (!player) return res.status(404).json({ error: "Player not found." });
//     // Find level by level number
//     const levelData = await Level.findOne({ levelNumber: level });
//     if (!levelData) return res.status(404).json({ msg: "Level not found" });
//     // Check if the player already completed this level
//     const sessionWithCompletedLevel = await Gamesession.findOne({
//       playerId,
//       completedLevels: levelData?._id,
//     });
//     if (sessionWithCompletedLevel) {
//       return res
//         .status(400)
//         .json({ message: "You have already completed this level." });
//     }
//     else {
//       // Fetch the user's game session
//       const gameSession = await secondGameSession.findOne({ playerId });

//       if (!gameSession) {
//         return res.status(404).json({ message: "Game session not found" });
//       }
//       const { completedLevels, currentLevel } = gameSession;

//       // Define accessible levels based on the rules
//       const accessibleLevels = [];
//       for (let i = 1; i <= 10; i++) {
//         if (i <= 3 || (i <= currentLevel && completedLevels.includes(i))) {
//           accessibleLevels.push(i);
//         }
//       }
//       return res.json({
//         message: "get Player info.",
//         accessibleLevels,
//         currentLevel
//       });
//     }

//   } catch (error) {
//     return res.status(500).json({ message: "Server error", error });
//   }
// });

// check Valid level 
module.exports.getLevelAccess = catchAsyncErrors(async (req, res) => {
  const { level } = req.body;
  const user = req.user;
  const playerId = user._id;
  try {
    // Find player
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: "Player not found." });
    // Find level by level number
    const levelData = await Level.findOne({ levelNumber: level });
    if (!levelData) return res.status(404).json({ msg: "Level not found" });
    // Check if the player already completed this level
    const sessionWithCompletedLevel = await Gamesession.findOne({
      playerId,
      completedLevels: levelData?._id,
    });
    if (sessionWithCompletedLevel) {
      return res
        .status(400)
        .json({ message: "You have already completed this level." });
    }
    // next flow handle paid or free 

    return res
      .status(200)
      .json({ message: "you have start game " });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// get Questions For Level
module.exports.getQuestionsForLevel = catchAsyncErrors(
  async (req, res, next) => {
    const { level } = req.body;
    const user = req.user;
    const playerId = user._id;
    const questionCount = parseInt(req.query.count) || 10;

    try {
      // Find player
      const player = await Player.findById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found." });
      }

      // Find level by level number
      const getlevel = await Level.findOne({ levelNumber: level });
      if (!getlevel)
        return res.status(404).json({ message: "Level not found." });

      // Check if the player already completed this level
      const sessionWithCompletedLevel = await Gamesession.findOne({
        playerId,
        completedLevels: getlevel._id, // Ensure the comparison uses ObjectId
      });

      if (sessionWithCompletedLevel) {
        return res
          .status(400)
          .json({ message: "You have already completed this level." });
      }

      // Retrieve or create session
      let Qsession = await Gamesession.findOne({ playerId });
      if (!Qsession) {
        Qsession = await Gamesession.create({ playerId });
      }

      // Check if level-specific questions are already in session
      let levelData = Qsession.levelScores.find(
        (score) => score.level.toString() === getlevel._id.toString()
      );

      let questions;
      if (levelData && levelData?.questions?.length >= questionCount) {
        questions = await Question.aggregate([
          {
            $match: {
              _id: { $in: levelData.questions.map((q) => q.questionId) },
            },
          },
          {
            $project: {
              // questionId: {
              // _id: "$_id",
              questionText: "$questionText",
              options: "$options",
              scores: "$scores",
              correctOptions: "$correctOptions",
              level: "$level",
              // },
              questionText: "$questionText",
              answer: { $literal: null },
              score: { $literal: 0 },
            },
          },
        ]);
      } else {
        questions = await Question.aggregate([
          { $match: { level: getlevel._id } },
          { $sample: { size: questionCount } },
        ]);

        if (questions.length === 0) {
          return res
            .status(404)
            .json({ message: "No questions found for this level." });
        }

        const formattedQuestions = questions.map((question) => ({
          questionId: question,
          answer: null,
          score: 0,
        }));

        if (levelData) {
          levelData.questions = formattedQuestions;
        } else {
          Qsession.levelScores.push({
            level: new mongoose.Types.ObjectId(getlevel._id), // Convert to ObjectId
            score: 0,
            questions: formattedQuestions,
          });
          Qsession.currentLevel = level
        }

        await Qsession.save();

        levelData = Qsession.levelScores.find(
          (score) => score.level.toString() === getlevel._id.toString()
        );
      }
      // Return formatted questions with question text
      const formattedQuestions = levelData?.questions.map((storedQuestion) => {
        // Find the matching question from the database
        return questions.find((question) =>
          question._id.toString() === storedQuestion.questionId.toString()
        );
      }).filter(Boolean); // Remove any null values if no match is found

      return res.status(200).json({
        formattedQuestions,
        status: true,
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions." });
    }
  }
);

// Submit answers for a level
module.exports.submitAnswer = catchAsyncErrors(async (req, res, next) => {
  const { level, answers, questionId, index } = req.body;
  const user = req.user;
  const playerId = user._id;

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

        if (!question) return res.status(404).json({ error: "Question not found" });

        // Map 'A', 'B', 'C', 'D' to index
        const answerMap = {
          A: 0,
          B: 1,
          C: 2,
          D: 3,
        };

        // Step 1: Convert the user's answer (e.g., 'a') to its corresponding index
        const answerIndex = answerMap[answers]; // 'answers' is 'A', 'B', 'C', or 'D'
        // Step 2: If the answer is correct (index matches the correct answer)
        let score = 0;
        if (
          answerIndex !== undefined && // Check if the answer exists
          question.correctOptions.includes(answerIndex)
        ) {
          score = question.scores[answerIndex];
        }

        // Update the specific question at the specified index
        questionEntry.answer = answers;
        questionEntry.score = score;
      }

      // Special case for index 9: Calculate average score for 10 questions
      if (index == 9) {

        const totalScore = existingLevel.questions.reduce(
          (sum, q) => sum + (q.score || 0),
          0
        );

        const averageScore = totalScore / existingLevel?.questions?.length * 10;

        existingLevel.score = averageScore;

        // Mark the level as completed if not already in completedLevels
        if (!player.completedLevels.includes(getLevel._id)) {
          player.completedLevels.push(getLevel._id);
          player.currentLevel = level
        }
      }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid index or question does not exist" });
    }

    // Save player data after updating
    await player.save();

    return res.status(200).json({ success: true, error: false, player });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).json({ error: "Failed to submit answers." });
  }
});

// Get result for a specific level
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
