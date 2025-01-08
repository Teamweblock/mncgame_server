// backend/models/Question.js
const mongoose = require("mongoose");
const meetGameRoleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true },
    profileimg: { type: String, required: true },
    description: { type: String, required: true },
    buttonColor: { type: String },
    buttonHoverColor: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("meetGameRole", meetGameRoleSchema);
