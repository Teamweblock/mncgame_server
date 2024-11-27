const mongoose = require("mongoose");

const secondgameSessionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    completedLevels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Level" }],
    currentLevel: {
      type: Number,
      required: true,
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
              ref: "Question",
            },
            answer: { type: String },
            score: { type: Number, default: 0 },
          },
        ],
      },
    ],
    // startTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("secondGameSession", secondgameSessionSchema);
