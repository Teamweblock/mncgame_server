const express = require("express");
const router = express.Router();
const {
  registerPlayer,
  loginPlayer,
  getallPlayers,
  getsinglePlayers,
  deletePlayer,
  updatePlayers,
  resetpassword,
  forgotpassword,
  ConnectMessage,
  googleAuth,
  getPlayer,
  getWeeklyAnalysis,
  getRecentActivity,
  skillsOverview,
  gameOverview,
  problemPilotOverview,
  entrepreneurialEdgeOverview,
  strategyTrialOverview
} = require("../controllers/playerControllers");
const {
  creatlevel,
  getalllevels,
  getsinglelevels,
  deletelevel,
  updatelevels,
} = require("../controllers/levelControllers");
const {
  creatGame,
  getallGames,
  getsingleGame,
  deleteGame,
  updateGames,
} = require("../controllers/gameControllers");
const { isAuthenticatedUser } = require("../middleware/auth");


/* --------- player crud section ----------  */

// player register and login
router.post("/register", registerPlayer);
router.post("/login", loginPlayer);
router.post("/auth/google", googleAuth);
router.get("/profile", isAuthenticatedUser, getPlayer);
router.post("/forgotpassword", forgotpassword);
router.post("/resetpassword", resetpassword);
router.post("/connect", ConnectMessage);

//getAllplayers
router.get("/all", getallPlayers);

// get single players
router.get("/single", getsinglePlayers);

//Delete
router.delete("/", deletePlayer);

//Update
router.put("/", updatePlayers);

router.post("/weeklyanalysis", isAuthenticatedUser, getWeeklyAnalysis);
router.post("/recentactivity", isAuthenticatedUser, getRecentActivity);
router.post("/userskillsoverview", isAuthenticatedUser, skillsOverview);
router.get("/gameOverview", isAuthenticatedUser, gameOverview);
router.get("/problem-pilot", isAuthenticatedUser, problemPilotOverview);
router.get("/entrepreneurial-edge", isAuthenticatedUser, entrepreneurialEdgeOverview);
router.get("/strategy-trial", isAuthenticatedUser, strategyTrialOverview);

/* --------- level crud section ----------  */

// add
router.post("/level/create", creatlevel);

//getAlllevels
router.get("/level/all", getalllevels);

// get single levels
router.get("/level/single", getsinglelevels);

//Delete
router.delete("/level/", deletelevel);

//Update
router.put("/level/", updatelevels);

/* --------- game crud section ----------  */

// add
router.post("/game/create", creatGame);

//getAllgames
router.get("/game/all", getallGames);

// get single games
router.get("/game/single", getsingleGame);

//Delete
router.delete("/game/", deleteGame);

//Update
router.put("/game/", updateGames);

module.exports = router;
