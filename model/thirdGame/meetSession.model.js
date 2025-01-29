const mongoose = require("mongoose");

const meetGamegameSessionSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    role: { type: String },
    levelScores: [
      {
        isPaired: { type: Boolean, default: true }, // to indicate pairing status
        roomCode: { type: String },
        question: { type: String },
        userprogress: [
          {
            playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
            creativity: { type: Number, default: 0 },
            strategicThinking: { type: Number, default: 0 },
            fundamentalSkills: { type: Number, default: 0 },
            managementSkills: { type: Number, default: 0 },
            overallImpact: { type: Number, default: 0 },
          }
        ],
        score: { type: Number, default: 0 },
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
