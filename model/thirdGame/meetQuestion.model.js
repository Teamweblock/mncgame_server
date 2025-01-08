const mongoose = require("mongoose");

const meetGameQuestionSchema = new mongoose.Schema(
  {
    Situation : { type: String, required: true },
    Roledetails: [
      {
        role: { type: String },
        About_Role: { type: String },
        Problem: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("meetGameQuestion", meetGameQuestionSchema);
