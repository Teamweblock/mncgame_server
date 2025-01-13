const mongoose = require("mongoose");

const singlegameSessionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    completedLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Level" }],
    currentLevel: {
      type: Number,
      default: 1, // Player starts from level 1
    }, // Default starting at level 1
    levelScores: [
      {
        level: { type: mongoose.Schema.Types.ObjectId, ref: "Level" },
        score: { type: Number, default: 0 },
        questions: [
          {
            questionId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "FirstgameQuestion",
            },
            answer: { type: String },
            score: { type: Number, default: 0 },
          },
        ],
        timeSpent: {
          startTime: { type: Date, default: Date.now() }, // When the player started the level
          endTime: { type: Date }, // When the player finished the level
        }
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SingleGameSession", singlegameSessionSchema);
