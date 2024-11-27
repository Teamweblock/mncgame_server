const express = require("express");
const router = express.Router();
const {
  creatQuestion,
  getallQuestions,
  getsingleQuestions,
  updateQuestions,
  deleteQuestion,
} = require("../controllers/game_secound/secondquestionControllers");

const {
  creatgameSession,
  getallgameSessions,
  getsinglegameSessions,
  deletegameSession,
  updategameSessions,
  getplayerResult,
  getQuestionsForLevel,
  submitAnswer,
  getLevelAccess
} = require("../controllers/game_secound/gameSessionControllers");
const { isAuthenticatedUser } = require("../middleware/auth");

/* --------- quetion crud section ----------  */

// add
router.post("/question/create", creatQuestion);

//getAllQuestions
router.get("/question/all", getallQuestions);

// get single Questions
router.get("/question/single", getsingleQuestions);

//Delete
router.delete("/question/", deleteQuestion);

//Update
router.put("/question/", updateQuestions);

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

/* --------- second game crud section ----------  */

// check player valid level
router.post("/checkVaildlevel", isAuthenticatedUser, getLevelAccess);

//get Questions For Level
router.post("/getQuestionsForLevel", isAuthenticatedUser, getQuestionsForLevel);

// submit answer
router.post("/submitanswer", isAuthenticatedUser, submitAnswer);

// get result
router.post("/getplayerResult", isAuthenticatedUser, getplayerResult);

module.exports = router;
