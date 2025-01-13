const mongoose = require("mongoose");

const meetGamegameSessionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    levelScores: [
      {
        score: { type: Number, default: 0 },
        roomCode: { type: String },
        isPaired: { type: Boolean, default: true }, // to indicate pairing status
        question: { type: String },
        timeSpent: {
          startTime: { type: Date, default: Date.now() }, // When the player started the level
          endTime: { type: Date }, // When the player finished the level
        }
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "meetGameGameSession",
  meetGamegameSessionSchema
);
