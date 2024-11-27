const mongoose = require("mongoose");

const firstgameQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    correctOptions: { type: String, required: true },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FirstgameQuestion", firstgameQuestionSchema);
