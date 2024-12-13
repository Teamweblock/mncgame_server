const mongoose = require("mongoose");

const multiplegameSessionSchema = new mongoose.Schema(
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
        gameType: {
          type: String,
          enum: ["single", "multiple"],
          default: "single", // default to single player
        },
        level: { type: mongoose.Schema.Types.ObjectId, ref: "Level" },
        score: { type: Number, default: 0 },
        roomCode: { type: String },
        isPaired: { type: Boolean, default: false }, // to indicate pairing status
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
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("MultipleGameSession", multiplegameSessionSchema);
