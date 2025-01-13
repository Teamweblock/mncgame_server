const Player = require("../model/Player.model");
const jwt = require("jsonwebtoken");
const passport = require('passport');
const crypto = require("crypto");
const ErrorHander = require("../utils/errorhandaler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { JWT_ACCESS_SECRET, JWT_ACCESS_TIME } = require("../config");
const { sendResetPasswordEmail } = require("../Configuration/emailService");
const { oauth2Client } = require('../Configuration/passport');
const { getWeeklyAnalysis, fetchGameData, validateDates } = require("../Configuration/comman");
// Import game models
const MultipleGameSession = require("../model/FirstGame/multipleSession.model");
const SingleGameSession = require("../model/FirstGame/singleSession.model");
const SecondGameSession = require("../model/SecondGame/secondgameSession.model");
const MeetGameGameSession = require("../model/thirdGame/meetSession.model");

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

module.exports.getPlayer = catchAsyncErrors(async (req, res, next) => {
  const user = req.user;
  const playerId = user._id;
  const userData = await Player.findById(playerId);

  if (!userData) {
    return next(new ErrorHander("userData not found", 404));
  } else {
    res.status(200).json({
      success: true,
      userData,
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

  const { firstName, lastName, email, mobileNumber, educationDetails, professionalDetails } = req.body;

  // Find the player
  const player = await Player.findById(id);

  if (!player) {
    return next(new ErrorHander("Cannot find Player.", 404));
  }

  try {
    // Update player fields dynamically
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (mobileNumber) updateFields.mobileNumber = mobileNumber;

    // Handle nested objects for educationDetails and professionalDetails
    if (educationDetails) {
      updateFields.educationDetails = {
        ...player.educationDetails.toObject(), // Preserve existing data
        ...educationDetails, // Update with new data
      };
    }

    if (professionalDetails) {
      updateFields.professionalDetails = {
        ...player.professionalDetails.toObject(), // Preserve existing data
        ...professionalDetails, // Update with new data
      };
    }

    // Find and update player
    const updatedPlayer = await Player.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true, // Ensure schema validation
    });

    if (!updatedPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }

    return res.status(200).json({
      success: true,
      msg: "Updated successfully.",
      updatedPlayer,
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to update Player",
      error: error.message,
    });
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

module.exports.getWeeklyAnalysis = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  let { startDate, endDate } = req.body;

  if (!playerId) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    // // Calculate the start and end dates for the current week if not provided
    // if (!startDate || !endDate) {
    //   const currentDate = new Date();
    //   const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
    //   const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Calculate difference to Monday
    //   const monday = new Date(currentDate);
    //   monday.setDate(currentDate.getDate() + diffToMonday); // Set to the current week's Monday
    //   monday.setHours(0, 0, 0, 0); // Set to start of the day

    //   const sunday = new Date(monday);
    //   sunday.setDate(monday.getDate() + 6); // Set to the current week's Sunday
    //   sunday.setHours(23, 59, 59, 999); // Set to end of the day

    //   startDate = monday;
    //   endDate = sunday;
    // } else {
    //   startDate = new Date(startDate);
    //   endDate = new Date(endDate);
    // }
    
    // Calculate the last 7 days (including today) if dates are not provided
    if (!startDate || !endDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Start of 7 days ago
      sevenDaysAgo.setHours(0, 0, 0, 0); // Start of the day

      startDate = sevenDaysAgo;
      endDate = today;
    } else {
      startDate = new Date(startDate);
      endDate = new Date(endDate);
    }

    // Validate the dates
    validateDates(startDate, endDate);

    // Fetch the report
    const report = await getWeeklyAnalysis(playerId, startDate, endDate);

    return res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Get Recent Activity
module.exports.getRecentActivity = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;

  try {
    // Fetch activities from all game session collections
    const singleGameSessions = await SingleGameSession.find({ playerId })
      .select("updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5); // Adjust limit as needed

    const multipleGameSession = await MultipleGameSession.find({ playerId })
      .select("updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5);

    const secondGameSessions = await SecondGameSession.find({ playerId })
      .select("updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5);

    const meetGameGameSessions = await MeetGameGameSession.find({ playerId })
      .select("updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5);

    // Combine all activities
    const allActivities = [
      ...singleGameSessions.map((session) => ({
        type: "SingleGameSession",
        timestamp: session.updatedAt,
      })),
      ...multipleGameSession.map((session) => ({
        type: "MultipleGameSession",
        timestamp: session.updatedAt,
      })),
      ...secondGameSessions.map((session) => ({
        type: "SecondGameSession",
        timestamp: session.updatedAt,
      })),
      ...meetGameGameSessions.map((session) => ({
        type: "MeetGameGameSession",
        timestamp: session.updatedAt,
      })),
    ];

    // Sort activities by timestamp (most recent first)
    const sortedActivities = allActivities.sort(
      (a, b) => b.timestamp - a.timestamp
    );

    return res.status(200).json(sortedActivities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

module.exports.skillsOverview = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;

  try {
    // Function to fetch and prepare data for a game
    const fetchGameData = async (Model) => {
      const data = await Model.aggregate([
        { $match: { playerId: playerId } }, // Filter by playerId
        { $unwind: "$levelScores" },
        {
          $group: {
            _id: { $month: "$updatedAt" },
            averageScore: { $avg: "$levelScores.score" },
          },
        },
        { $sort: { "_id": 1 } },
      ]);

      // Convert data to a map for easier access
      return data.reduce((acc, item) => {
        acc[item._id] = item.averageScore;
        return acc;
      }, {});
    };

    // Fetch data for all games
    const firstGameData = await fetchGameData(SingleGameSession);
    const secondGameData = await fetchGameData(SecondGameSession);
    const thirdGameData = await fetchGameData(MeetGameGameSession);

    // Define all months (1-12)
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Prepare data for all months
    const prepareData = (dataMap) =>
      allMonths.map((month) => dataMap[month] || 0);

    const response = {
      labels: monthNames, // All month names
      datasets: [
        {
          label: "Problem Pilot",
          data: prepareData(firstGameData),
          borderColor: "blue",
          fill: false,
        },
        {
          label: "Entrepreneurial Edge",
          data: prepareData(secondGameData),
          borderColor: "cyan",
          fill: false,
        },
        {
          label: "Strategy Trial",
          data: prepareData(thirdGameData),
          borderColor: "orange",
          fill: false,
        },
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching user skill overview data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});


module.exports.problemPilotOverview = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  // Extract body parameters
  const timeRange = req.body.range || "monthly"; // Default to monthly
  const startDate = req.body.startDate; // Expected format: YYYY-MM-DD
  const endDate = req.body.endDate; // Expected format: YYYY-MM-DD


  try {
    // Validate dates
    validateDates(startDate, endDate);
    const gameData = await fetchGameData(SingleGameSession, playerId, timeRange, startDate, endDate);

    const labels = gameData.map((item) => item._id);
    const data = gameData.map((item) => item.averageScore);

    const response = {
      labels,
      datasets: [
        {
          label: "Problem Pilot",
          data,
          fill: false,
        },
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching Problem Pilot data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports.entrepreneurialEdgeOverview = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  // Extract body parameters
  const timeRange = req.body.range || "monthly"; // Default to monthly
  const startDate = req.body.startDate; // Expected format: YYYY-MM-DD
  const endDate = req.body.endDate; // Expected format: YYYY-MM-DD

  try {
    // Validate dates
    validateDates(startDate, endDate);
    const gameData = await fetchGameData(SecondGameSession, playerId, timeRange, startDate, endDate);

    const labels = gameData.map((item) => item._id);
    const data = gameData.map((item) => item.averageScore);

    const response = {
      labels,
      datasets: [
        {
          label: "Entrepreneurial Edge",
          data,
          fill: false,
        },
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching Entrepreneurial Edge data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports.strategyTrialOverview = catchAsyncErrors(async (req, res) => {
  const user = req.user;
  const playerId = user._id;
  // Extract body parameters
  const timeRange = req.body.range || "monthly"; // Default to monthly
  const startDate = req.body.startDate; // Expected format: YYYY-MM-DD
  const endDate = req.body.endDate; // Expected format: YYYY-MM-DD

  try {
    // Validate dates
    validateDates(startDate, endDate);
    const gameData = await fetchGameData(MeetGameGameSession, playerId, timeRange, startDate, endDate);

    const labels = gameData.map((item) => item._id);
    const data = gameData.map((item) => item.averageScore);

    const response = {
      labels,
      datasets: [
        {
          label: "Strategy Trial",
          data,
          fill: false,
        },
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("Error fetching Strategy Trial data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});
