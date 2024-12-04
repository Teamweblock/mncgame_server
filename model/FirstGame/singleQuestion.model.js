const mongoose = require("mongoose");

const singleQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SingleQuestion", singleQuestionSchema);
