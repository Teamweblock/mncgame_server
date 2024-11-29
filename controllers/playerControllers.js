const Player = require("../model/Player.model");
const jwt = require("jsonwebtoken");
const passport = require('passport');
const ErrorHander = require("../utils/errorhandaler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { JWT_ACCESS_SECRET, JWT_ACCESS_TIME } = require("../config");
const { sendResetPasswordEmail } = require("../Configuration/emailService");
const { oauth2Client } = require('../Configuration/passport');
const crypto = require("crypto");

// Register API (create Players)
module.exports.registerPlayer = catchAsyncErrors(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    let player = await Player.findOne({ email });
    if (player) {
      return res.status(400).json({ message: "Player already exists" });
    }

    player = new Player({ firstName, lastName, email, password });
    await player.save();

    const token = jwt.sign({ playerId: player._id }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_TIME });

    return res.status(201).json({
      message: "Player registered successfully",
      success: true,
      error: false,
      token,
      player,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to register player" });
  }
});

// Login API
module.exports.loginPlayer = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const player = await Player.findOne({ email });

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    // Check if the password matches
    const isMatch = await player.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign({ playerId: player._id }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_TIME });
    return res.status(200).json({
      message: "Player logged in successfully",
      success: true,
      error: false,
      token,
      player,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to login player" });
  }
});

// logout
module.exports.logout = catchAsyncErrors(async (req, res, next) => {
  try {
    res.cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Logged Out",
    });
    next();
  } catch (error) {
    res.status(500).json({ error: "Failed to logout player" });
  }
});

// Google login route
module.exports.googleLogin = catchAsyncErrors(async (req, res, next) => {
  const { tokenId } = req.body; // The ID token from the frontend (sent after Google login)

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID, // Your Google Client ID
    });

    const profile = ticket.getPayload(); // Get the user profile

    // Check if the player already exists in the database
    var player = await Player.findOne({ email: profile.email });

    if (!player) {
      // Player doesn't exist, create a new player
      player = new Player({
        firstName: profile.given_name,
        lastName: profile.family_name,
        email: profile.email,
      });
      await player.save();
    }

    // Create JWT token for the player
    const token = jwt.sign({ playerId: player._id }, JWT_ACCESS_SECRET, {
      expiresIn: JWT_ACCESS_TIME,
    });

    return res.status(200).json({
      message: "Google login successful",
      success: true,
      player, // Return player info
      token,  // Return JWT token
    });
  } catch (error) {
    console.log("Google login error:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
});

// Define the Google Authentication API
module.exports.googleAuth = catchAsyncErrors(async (req, res, next) => {
  const tokenId = req.body.tokenId;
  try {
    // Verify the ID token received from Google
    const googleRes = await oauth2Client.verifyIdToken({
      idToken: tokenId,                     // The ID token from the frontend
      audience: process.env.GOOGLE_CLIENT_ID,  // Ensure the client ID matches
    });

    const payload = googleRes.getPayload();  // Extract user information from the payload
    const { email, given_name, family_name } = payload;  // Extract email, name, and picture from the payload
    let player = await Player.findOne({ email });

    if (!player) {
      // If the player doesn't exist, create a new player
      player = await Player.create({
        firstName: given_name,
        lastName: family_name,
        email: email,
      });
    }

    const jwtToken = jwt.sign({ playerId: player._id }, JWT_ACCESS_SECRET, {
      expiresIn: JWT_ACCESS_TIME,  // Set the JWT expiration time
    });

    res.status(200).json({
      message: "Player logged in successfully",
      success: true,
      error: false,
      token: jwtToken,  // Send the token back to the frontend
      player,
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

module.exports.googleCallback = catchAsyncErrors(async (req, res, next) => {
  passport.authenticate('google', { failureRedirect: '/' }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: 'Authentication failed' });

    // Generate a token (JWT) if needed
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send response with user info and token
    res.status(200).json({
      message: 'Google login successful',
      success: true,
      player: user,
      token,
    });
  })(req, res, next); // Pass req, res, and next for middleware chaining
});

//get all Players
module.exports.getallPlayers = catchAsyncErrors(async (req, res) => {
  try {
    const Players = await Player.find();

    res.status(200).json({
      success: true,
      Players,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Players" });
  }
});

//getsinglePlayers
module.exports.getsinglePlayers = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;

  const Players = await Player.find({ _id: id });

  if (!Players) {
    return next(new ErrorHander("Players not found", 404));
  } else {
    res.status(200).json({
      success: true,
      Players,
    });
  }
});

//Delete Player
module.exports.deletePlayer = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const data = await Player.findByIdAndDelete(id);
    if (!data) {
      return next(new ErrorHander("Players not found", 404));
    }
    return res.status(200).json({ message: "Players deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update Player
module.exports.updatePlayers = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { firstName, lastName, email, score } = req.body;
  let Players = await Player.findById(id);

  if (!Players) {
    return next(new ErrorHander("Cannot found Players..", 404));
  }
  try {
    const updatedPlayer = await Player.findByIdAndUpdate(
      id,
      {
        firstName,
        lastName,
        email,
        score,
      },
      { new: true }
    );

    if (!updatedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updatedPlayer,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update Player" });
  }
});

// Route to handle forgot password
module.exports.forgotpassword = catchAsyncErrors(async (req, res) => {
  const { email } = req.body;
  // Find user by email
  let user = await Player.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid Email please try again!" });
  }
  // Generate a reset password token using the createJWT method
  // Get ResetPassword Token
  const resetToken = await user.getResetPasswordToken();
  user.resetToken = resetToken;
  user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
  await user.save();

  // Send the reset password email using the email service
  await sendResetPasswordEmail(user?.email, resetToken);

  // Respond with a success message
  return res.status(200).json({
    success: true,
    message: `Reset password link sent to the email ${user?.email}`,
  });
});

// resetpassword
module.exports.resetpassword = catchAsyncErrors(async (req, res) => {
  const { newPassword, confirmPassword, clientToken } = req.body;

  if (!newPassword || !clientToken) {
    return res
      .status(404)
      .json({ message: "New password and token are required" });
  }

  let user;
  try {
    // creating token hash
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(clientToken)
      .digest("hex");
    // Check if the user exists and the token is valid, we proceed to reset the password
    user = await Player.findOne({
      // email: payload.email,
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Password does not password" });
    }
    // Update the password directly (pre-save middleware will hash it)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

  } catch (error) {
    console.error(error);
    return res.status(201).json({ message: "Invalid or expired token" });
  }

  // Generate a new token for the user after the password reset
  const token = jwt.sign({ playerId: user._id }, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_TIME,
  });

  // Send the response with the updated user details and new token
  return res.status(200).json({
    user: { playerId: user._id, name: user.name },
    token,
    msg: "Password changed successfully",
  });
});

// updatepassword
module.exports.updatepassword = catchAsyncErrors(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const user = await Player.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Use the matchPassword method
    const isMatch = await Player.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update the password in the database
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
