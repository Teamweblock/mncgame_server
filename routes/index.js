const express = require("express");
const router = express.Router();
const homeControllers = require("../controllers/homeControllers.js");
const { googleCallback, googleAuth } = require("../controllers/playerControllers.js");

router.get("/", homeControllers.home);

// Google Callback Route
router.post('/auth/google/callback', googleCallback);
router.post('/auth/google', googleAuth);

// player
router.use("/player", require("./player"));

// firstGame
router.use("/firstGame", require("./firstGame"));

//secoundGame
router.use("/secoundGame", require("./secoundGame"));

module.exports = router;
