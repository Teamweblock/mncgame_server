const mongoose = require("mongoose");

const multipleQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    // answer: { type: String },
    level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Level",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MultipleQuestion", multipleQuestionSchema);
