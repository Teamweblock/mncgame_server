const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gameNumber: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
