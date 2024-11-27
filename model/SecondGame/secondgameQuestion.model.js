// backend/models/Question.js
const mongoose = require("mongoose");
const secondgameQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    scores: [{ type: Number, required: true }], // Scoring percentages for each option
    correctOptions: [{ type: Number, required: true }], // Indices of correct answers
    level: { type: mongoose.Schema.Types.ObjectId, ref: "Level" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("secondgameQuestion", secondgameQuestionSchema);
