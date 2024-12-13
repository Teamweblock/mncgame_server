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
  creatmultipleQuestion,
  getallmultipleQuestions,
  getsinglemultipleQuestions,
  updatemultipleQuestions,
  deletemultipleQuestion,
} = require("../controllers/game_first/multiplequestionControllers");

const {
  getQuestionsForsingleLevel,
  submitAnswer,
  creatgameSession,
  getallgameSessions,
  getsinglegameSessions,
  deletegameSession,
  updategameSessions,
  getplayerResult,
  getLevelAccess,
  overallPerformance
} = require("../controllers/game_first/singlegameSessionControllers");

const {
  joinmultipleGame,
  getQuestionsFormultipleLevel
} = require("../controllers/game_first/multiplegameSessionControllers");

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

/* --------- multiple player crud section ----------  */

/*  quetion crud section  */

// add
router.post("/multiple/question/create", creatmultipleQuestion);

//getAllmultipleQuestions
router.get("/multiple/question/all", getallmultipleQuestions);

// get single multipleQuestions
router.get("/multiple/question/single", getsinglemultipleQuestions);

//Delete
router.delete("/multiple/question/", deletemultipleQuestion);

//Update
router.put("/multiple/question/", updatemultipleQuestions);

// ---------------------------------------------------------------------------------------

/* --------- firstgame crud section ----------  */

// check player valid level
router.post("/checkVaildlevel", isAuthenticatedUser, getLevelAccess);

//get Questions For Level
router.post("/single/getQuestionsForLevel", isAuthenticatedUser, getQuestionsForsingleLevel);
router.post("/multiple/getQuestionsForLevel", isAuthenticatedUser, getQuestionsFormultipleLevel);

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

//joinmultipleGame
router.post("/joinmultipleGame", isAuthenticatedUser, joinmultipleGame);

module.exports = router;
