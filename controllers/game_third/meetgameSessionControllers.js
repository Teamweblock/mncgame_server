const MeetGamesession = require("../../model/thirdGame/meetSession.model");
const Question = require("../../model/FirstGame/multipleQuestion.model");
const Player = require("../../model/Player.model");
const Level = require("../../model/Level.model");
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

module.exports.updateProgress = catchAsyncErrors(async (req, res) => {
  try {
    const user = req.user; // Assuming you are using authentication middleware
    const playerId = user._id; // Get the playerId from the authenticated user
    const { roomCode, progress, role } = req.body; // Get roomCode and progress from request body

    // Validate the required fields
    if (!playerId || !roomCode || !progress) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Ensure all required progress fields are present
    const requiredFields = [
      "creativity", "strategicThinking", "fundamentalSkills", "managementSkills", "overallImpact"
    ];

    for (let field of requiredFields) {
      if (progress[field] === undefined) {
        return res.status(400).json({ message: `Missing ${field} in progress` });
      }
    }

    // Find the session with matching roomCode
    let gameSession = await MeetGamesession.findOne({
      "levelScores.roomCode": roomCode,
    });

    if (!gameSession) {
      return res.status(404).json({ message: "Game session not found" });
    }

    // Find the levelScores entry for the matching roomCode
    let levelScore = gameSession.levelScores.find(
      (ls) => ls.roomCode === roomCode
    );

    if (!levelScore) {
      return res.status(404).json({ message: "Room code not found in session" });
    }

    // Find or create the player progress in userprogress
    let playerProgress = levelScore.userprogress.find(
      (user) => user.playerId.toString() === playerId.toString()
    );

    if (!playerProgress) {
      // If player progress doesn't exist, create it
      let updatePlayer = await MeetGamesession.findOne({
        "levelScores.roomCode": roomCode,
        role: role,
      });
      levelScore.userprogress.push({
        playerId: new mongoose.Types.ObjectId(updatePlayer?._id),
        ...progress,
      });
    } else {
      // If player progress exists, update it
      playerProgress.creativity = parseFloat((progress.creativity || playerProgress.creativity).toFixed(2));
      playerProgress.strategicThinking = parseFloat((progress.strategicThinking || playerProgress.strategicThinking).toFixed(2));
      playerProgress.fundamentalSkills = parseFloat((progress.fundamentalSkills || playerProgress.fundamentalSkills).toFixed(2));
      playerProgress.managementSkills = parseFloat((progress.managementSkills || playerProgress.managementSkills).toFixed(2));
      playerProgress.overallImpact = parseFloat((progress.overallImpact || playerProgress.overallImpact).toFixed(2));

    }

    // Save the updated session
    await gameSession.save();

    // Return the updated session and progress
    return res.status(200).json({
      status: true,
      message: "Progress updated successfully",
      updatedProgress: levelScore,
    });
  } catch (error) {
    console.error("Error updating progress:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports.getPlayerResults = catchAsyncErrors(async (req, res) => {
  try {
    const user = req.user;
    const playerId = user._id; // Player 1 (the main player)
    const { roomCode } = req.body; // playerId: Player 1, roomCode to identify the session

    if (!roomCode || !playerId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the session with matching roomCode and playerId
    let gameSession = await MeetGamesession.findOne({
      "levelScores.roomCode": roomCode,
      playerId: new mongoose.Types.ObjectId(playerId)
    });

    if (!gameSession) {
      return res.status(404).json({ message: "Game session not found" });
    }

    // Find the levelScores entry for the given roomCode
    let levelScore = gameSession.levelScores.find(
      (ls) => ls.roomCode === roomCode
    );

    if (!levelScore) {
      return res.status(404).json({ message: "Room code not found in session" });
    }

    // Calculate category averages for all players (Player 1, 2, 3, 4)
    let categoryAverages = {
      creativity: 0,
      strategicThinking: 0,
      fundamentalSkills: 0,
      managementSkills: 0,
      overallImpact: 0,
    };

    // Player Results Array to store each player's result
    let playerResults = [];

    // Loop through the user progress for Player 2, 3, and 4 (assuming Player 1 is storing their scores)
    levelScore.userprogress.forEach((userProgress, index) => {
      const playerName = userProgress.playerId.name; // Assuming player name is in userProgress

      const avgCategoryScores = {
        creativity: parseFloat(userProgress.creativity.toFixed(2)),
        strategicThinking: parseFloat(userProgress.strategicThinking.toFixed(2)),
        fundamentalSkills: parseFloat(userProgress.fundamentalSkills.toFixed(2)),
        managementSkills: parseFloat(userProgress.managementSkills.toFixed(2)),
        overallImpact: parseFloat(userProgress.overallImpact.toFixed(2)),
      };

      // Calculate category-wise averages for this player
      const totalScore = Object.values(avgCategoryScores).reduce(
        (acc, score) => acc + score,
        0
      );
      const avgScore = parseFloat((totalScore / 5).toFixed(2));

      // Add player's category averages and overall average score to the results
      playerResults.push({
        playerId: userProgress.playerId._id,
        playerName,
        categoryAverages: avgCategoryScores,
        avgScore,
      });

      // Add to overall category averages
      categoryAverages.creativity += avgCategoryScores.creativity;
      categoryAverages.strategicThinking += avgCategoryScores.strategicThinking;
      categoryAverages.fundamentalSkills += avgCategoryScores.fundamentalSkills;
      categoryAverages.managementSkills += avgCategoryScores.managementSkills;
      categoryAverages.overallImpact += avgCategoryScores.overallImpact;
    });

    // Calculate overall averages for all players
    const numPlayers = playerResults.length;
    const overallCategoryAverages = {
      creativity: parseFloat((categoryAverages.creativity / numPlayers).toFixed(2)),
      strategicThinking: parseFloat((categoryAverages.strategicThinking / numPlayers).toFixed(2)),
      fundamentalSkills: parseFloat((categoryAverages.fundamentalSkills / numPlayers).toFixed(2)),
      managementSkills: parseFloat((categoryAverages.managementSkills / numPlayers).toFixed(2)),
      overallImpact: parseFloat((categoryAverages.overallImpact / numPlayers).toFixed(2)),
    };

    return res.status(200).json({
      message: "Player results fetched successfully",
      playerId,
      overallCategoryAverages,
      // playerResults,
    });
  } catch (error) {
    console.error("Error fetching player results:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


module.exports.overallPerformance = catchAsyncErrors(async (req, res) => {
  try {
    const user = req.user;
    const playerId = user._id; // Player 1 (the main player)
    const { roomCode, progress } = req.body; // progress contains scores for player 2, 3, 4

    if (!playerId || !roomCode || !progress) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the session with matching playerId and roomCode
    let gameSession = await MeetGamesession.findOne({
      playerId: new mongoose.Types.ObjectId(playerId),
      "levelScores.roomCode": roomCode,
    });

    if (!gameSession) {
      return res.status(404).json({ message: "Game session not found" });
    }

    // Find the levelScores entry for the given roomCode
    let levelScore = gameSession.levelScores.find(
      (ls) => ls.roomCode === roomCode
    );

    if (!levelScore) {
      return res.status(404).json({ message: "Room code not found in session" });
    }

    // Update player 2, 3, and 4 scores
    levelScore.userprogress.forEach((userProgress, index) => {
      if (index > 0) { // Update only players 2, 3, and 4
        const updatedProgress = progress[index - 1];
        userProgress.creativity = parseFloat((updatedProgress.creativity || userProgress.creativity).toFixed(2));
        userProgress.strategicThinking = parseFloat((updatedProgress.strategicThinking || userProgress.strategicThinking).toFixed(2));
        userProgress.fundamentalSkills = parseFloat((updatedProgress.fundamentalSkills || userProgress.fundamentalSkills).toFixed(2));
        userProgress.managementSkills = parseFloat((updatedProgress.managementSkills || userProgress.managementSkills).toFixed(2));
        userProgress.overallImpact = parseFloat((updatedProgress.overallImpact || userProgress.overallImpact).toFixed(2));



      }
    });

    // Calculate average score per category for each player
    levelScore.userprogress.forEach((userProgress) => {
      const totalScore = [
        userProgress.creativity,
        userProgress.strategicThinking,
        userProgress.fundamentalSkills,
        userProgress.managementSkills,
        userProgress.overallImpact,
      ].reduce((acc, curr) => acc + curr, 0);

      const avgScore = parseFloat((totalScore / 5).toFixed(2));

      // Add avgScore to player progress
      userProgress.avgScore = avgScore;
    });

    // Save the updated session
    await gameSession.save();

    // Prepare the response data
    const playerResults = levelScore.userprogress.map((userProgress) => {
      return {
        playerId: userProgress.playerId._id,
        playerName: userProgress.playerId.name, // Assuming 'name' field exists in Player model
        avgScore: userProgress.avgScore,
        categoryAverages: {
          creativity: userProgress.creativity,
          strategicThinking: userProgress.strategicThinking,
          fundamentalSkills: userProgress.fundamentalSkills,
          managementSkills: userProgress.managementSkills,
          overallImpact: userProgress.overallImpact,
        },
      };
    });

    // Sort players by avgScore (descending order)
    playerResults.sort((a, b) => b.avgScore - a.avgScore);

    return res.status(200).json({
      message: "Player scores updated and averages calculated successfully",
      playerId: playerId,
      playerResults,
    });
  } catch (error) {
    console.error("Error updating player scores:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});
