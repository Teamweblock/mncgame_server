const Game = require("../model/Game.model");
const ErrorHander = require("../utils/errorhandaler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// create Games
module.exports.creatGame = catchAsyncErrors(async (req, res, next) => {
  const { name, gameNumber } = req.body;
  try {
    const game = await Game.create({ name, gameNumber });
    if (!game || game.length === 0) {
      return next(new ErrorHander("Games cannot be created...", 404));
    }
    res.status(200).json({
      success: true,
      game,
    });
  } catch (error) {
    next(new ErrorHander("Error occurred while creating games", 500));
  }
});

//get all Games
module.exports.getallGames = catchAsyncErrors(async (req, res) => {
  try {
    const Games = await Game.find();
    res.status(200).json({
      success: true,
      Games,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

//getsingleGames
module.exports.getsingleGame = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const Game = await Game.find({ _id: id });
  if (!Game) {
    return next(new ErrorHander("Games not found", 404));
  } else {
    res.status(200).json({
      success: true,
      Game,
    });
  }
});

//Delete Game
module.exports.deleteGame = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    await Game.findByIdAndDelete(id);
    return res.status(200).json({ message: "Games deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update Game
module.exports.updateGames = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { name, gameNumber } = req.body;
  const game = await Game.findById(id);
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }
  try {
    const updatedGame = await Game.findByIdAndUpdate(
      id,
      {
        name,
        gameNumber,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updatedGame,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update question" });
  }
});
