const Gamesession = require("../model/FirstGame/firstgameSession.model");
const Question = require("../model/FirstGame/firstgameQuestion.model");
const Level = require("../model/Level.model");

const getFirstGameQuestions = async ({
  playerId,
  level,
  questionCount,
  gametype,
  roomCode,
}) => {
  // Find level by level number
  const levelData = await Level.findOne({ levelNumber: level });
  if (!levelData) {
    throw new Error("Level not found.");
  }

  // Check if the player already completed this level
  const sessionWithCompletedLevel = await Gamesession.findOne({
    playerId,
    completedLevels: levelData._id,
  });
  if (sessionWithCompletedLevel) {
    throw new Error("You have already completed this level.");
  }

  // Retrieve or create session
  let gameSession = await Gamesession.findOne({ playerId });
  if (!gameSession) {
    gameSession = await Gamesession.create({ playerId });
  }

  // Check if level-specific questions are already in session
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
      // {
      //   $project: {
      //     questionId: "$_id",
      //     questionText: "$questionText",
      //     answer: { $literal: null },
      //     score: { $literal: 0 },
      //   },
      // },
      {
        $project: {
          questionId: {
            _id: "$_id",
            questionText: "$questionText",
            correctOptions: "$correctOptions",
            level: "$level",
            // Add any additional fields from your schema here
          },
          questionText: "$questionText",
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
    if (questions.length === 0) {
      throw new Error("No questions found for this level.");
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
        level: levelData._id,
        score: 0,
        questions: formattedQuestions,
      });
    }
    await gameSession.save();
  }

  // Return formatted questions with question text
  return questions.map((question) => ({
    questionId: question,
    questionText: question.questionText,
    answer: null,
    score: 0,
  }));
};

module.exports = {
  getFirstGameQuestions,
};
