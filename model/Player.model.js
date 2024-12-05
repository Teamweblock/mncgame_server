const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const playerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide a firstName"],
      trim: true,
      maxLength: [20, "firstName cannot be more than 20 characters"],
      minlength: [2, "firstName cannot be less than 2 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Please provide a lastName"],
      trim: true,
      maxLength: [20, "lastName cannot be more than 20 characters"],
      minlength: [2, "lastName cannot be less than 2 characters"],
    },
    email: {
      type: String,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please provide a valid email",
      ],
      unique: true,
    },
    mobileNumber: {
      type: String,
      // unique: true, // Ensure uniqueness
      match: [/^\d{10}$/, "Please provide a valid 10-digit mobile number"], // Example regex for 10 digits
    },
    password: {
      type: String,
      // required: [true, "Please provide a password"],
      // minlength: [6, "Password cannot be less than 6 characters"],
    },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    // if particular level complete then usertype inactive
    userType: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive", // default to inactive player
    },

    address: { type: String },
    educationDetails: {
      currentJob: { type: String },
      companyName: { type: String },
      linkedInProfile: { type: String },
      skills_expertise: [String], // add options to select from dropdown
      address: { type: String },
    },
    professionalDetails: {
      currentJob: { type: String },
      companyName: { type: String },
      jobRole: { type: String },
      linkedInProfile: { type: String },
      skills: [String], // add options to select from dropdown
      expertise: [String], // add options to select from dropdown
    },
  },
  { timestamps: true }
);
// Hash password before saving player
playerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
playerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
//  Generating Password Reset Token
playerSchema.methods.getResetPasswordToken = async function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash the token and save it to the user document
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

  await this.save({ validateBeforeSave: false });

  return resetToken; // Return the plain token
};
module.exports = mongoose.model("Player", playerSchema);
