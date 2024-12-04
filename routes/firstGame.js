const express = require("express");
const router = express.Router();
const { isAuthenticatedUser } = require("../middleware/auth");
const {
  creatsingleQuestion,
  getallsingleQuestions,
  getsinglesingleQuestions,
  updatesingleQuestions,
  deletesingleQuestion,
} = require("../controllers/game_first/singlequestionControllers");

const {
  getQuestionsForLevel,
  submitAnswer,
  creatgameSession,
  getallgameSessions,
  getsinglegameSessions,
  deletegameSession,
  updategameSessions,
  getplayerResult,
  // joinmultipleGame,
  getLevelAccess,
  overallPerformance
} = require("../controllers/game_first/singlegameSessionControllers");

/* --------- single player crud section --------- */

/*  quetion crud section  */

// add
router.post("/single/question/create", creatsingleQuestion);

//getAllsingleQuestions
router.get("/single/question/all", getallsingleQuestions);

// get single singleQuestions
router.get("/single/question/single", getsinglesingleQuestions);

//Delete
router.delete("/single/question/", deletesingleQuestion);

//Update
router.put("/single/question/", updatesingleQuestions);

/* --------- firstgame crud section ----------  */

// check player valid level
router.post("/checkVaildlevel", isAuthenticatedUser, getLevelAccess);

//get Questions For Level
router.post("/getQuestionsForLevel", isAuthenticatedUser, getQuestionsForLevel);

//joinmultipleGame
// router.post("/joinmultipleGame", isAuthenticatedUser, joinmultipleGame);

// submit answer
router.post("/submitanswer", isAuthenticatedUser, submitAnswer);

//  get player result
router.post("/getplayerResult", isAuthenticatedUser, getplayerResult);

//  get player result
router.get("/overallPerformance", isAuthenticatedUser, overallPerformance);

/* --------- game crud section ----------  */

// add

router.post("/create", creatgameSession);

//getAllgameSessions
router.get("/all", getallgameSessions);

// get single gameSessions
router.get("/single", getsinglegameSessions);

//Delete
router.delete("/", deletegameSession);

//Update
router.put("/", updategameSessions);

module.exports = router;
