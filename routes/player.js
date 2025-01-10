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
  googleAuth,
  getPlayer,
  getWeeklyAnalysis,
  getRecentActivity,
  skillsOverview
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
