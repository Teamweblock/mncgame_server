const express = require("express");
const router = express.Router();
const { isAuthenticatedUser } = require("../middleware/auth");
const {
  creatmeetQuestion,
  getallmeetQuestions,
  getsinglemeetQuestions,
  updatemeetQuestions,
  deletemeetQuestion,
} = require("../controllers/game_third/meetquestionControllers");

const {
  creatmeetRole,
  getallmeetRoles,
  getsinglemeetRoles,
  updatemeetRoles,
  deletemeetRole,
} = require("../controllers/game_third/meetRoleControllers");

const {
  joinmeetGame,
  submitMultiAnswer
} = require("../controllers/game_third/meetgameSessionControllers");
/*  Role crud section  */

// add
router.post("/meet/role/create", creatmeetRole);

//getAllmeetRoles
router.get("/meet/role/all", getallmeetRoles);

// get single meetRoles
router.get("/meet/role/single", getsinglemeetRoles);

//Delete
router.delete("/meet/role/", deletemeetRole);

//Update
router.put("/meet/role/", updatemeetRoles);

/*  quetion crud section  */

// add
router.post("/meet/question/create", creatmeetQuestion);

//getAllmeetQuestions
router.get("/meet/question/all", getallmeetQuestions);

// get single meetQuestions
router.get("/meet/question/single", getsinglemeetQuestions);

//Delete
router.delete("/meet/question/", deletemeetQuestion);

//Update
router.put("/meet/question/", updatemeetQuestions);

router.post("/meet/submitanswer", isAuthenticatedUser, submitMultiAnswer);

/* --------- game crud section ----------  */

//joinmeetGame
router.post("/joinmeetGame", isAuthenticatedUser, joinmeetGame);

module.exports = router;
