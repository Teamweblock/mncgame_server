const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema(
  {
    levelNumber: { type: Number, required: true },
    difficulty: { type: String }, // Optional: if you want to set difficulty scaling
    // difficulty:  String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Level", levelSchema);
