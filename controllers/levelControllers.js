const Level = require("../model/Level.model");
const ErrorHander = require("../utils/errorhandaler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// create levels
module.exports.creatlevel = catchAsyncErrors(async (req, res, next) => {
  const { levelNumber } = req.body;
  const levels = await Level.create({
    levelNumber,
  });
  if (!levels) {
    return next(new ErrorHander("levels cannot be created...", 404));
  }
  res.status(200).json({
    success: true,
    levels,
  });
});

//get all levels
module.exports.getalllevels = catchAsyncErrors(async (req, res) => {
  try {
    const levels = await Level.find();
    res.status(200).json({
      success: true,
      levels,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch levels" });
  }
});

//getsinglelevels
module.exports.getsinglelevels = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  let level = await Level.findById(id);

  if (!level) {
    return next(new ErrorHander("Cannot found levels..", 404));
  }
  res.status(200).json({
    success: true,
    level,
  });
});

//Delete level
module.exports.deletelevel = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const deletelevel = await Level.findByIdAndDelete(id);
    if (!deletelevel) {
      return next(new ErrorHander("levels not found", 404));
    }
    return res.status(200).json({ message: "levels deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update level
module.exports.updatelevels = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { levelNumber } = req.body;
  let level = await Level.findById(id);

  if (!level) {
    return next(new ErrorHander("Cannot found level..", 404));
  }
  try {
    const updatedlevel = await Level.findByIdAndUpdate(
      id,
      {
        levelNumber,
      },
      { new: true }
    );

    if (!updatedlevel) {
      return res.status(404).json({ message: "level not found" });
    }

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updatedlevel,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update level" });
  }
});
