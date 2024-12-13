// backend/models/Question.js
const mongoose = require("mongoose");
const secondgameQuestionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("secondgameQuestion", secondgameQuestionSchema);
