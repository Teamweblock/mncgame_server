const squestion = require("../../model/SecondGame/secondgameQuestion.model");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");

// create sQuestions
module.exports.creatQuestion = catchAsyncErrors(async (req, res, next) => {
  const sQuestionsData = req.body; // Array of sQuestion objects

  try {
    const sQuestions = await squestion.insertMany(sQuestionsData);

    if (!sQuestions || sQuestions.length === 0) {
      return next(new ErrorHander("sQuestions cannot be created...", 404));
    }

    res.status(200).json({
      success: true,
      sQuestions,
    });
  } catch (error) {
    console.log("error", error);

    next(new ErrorHander("Error occurred while creating sQuestions", 500));
  }
});

//get all sQuestions
module.exports.getallQuestions = catchAsyncErrors(async (req, res) => {
  try {
    const sQuestions = await squestion.find();

    res.status(200).json({
      success: true,
      sQuestions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sQuestions" });
  }
});

//getsinglesQuestions
module.exports.getsingleQuestions = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;

  const sQuestions = await squestion.find({ _id: id });

  if (!sQuestions) {
    return next(new ErrorHander("sQuestions not found", 404));
  } else {
    res.status(200).json({
      success: true,
      sQuestions,
    });
  }
});

//Delete sQuestion
module.exports.deleteQuestion = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const data = await squestion.findByIdAndDelete(id);
    if (!data) {
      return next(new ErrorHander("sQuestions not found", 404));
    }
    return res.status(200).json({ message: "sQuestions deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update sQuestion
module.exports.updateQuestions = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { questionText, options, correctOptions, level } = req.body;
  let sQuestions = await squestion.findById(id);

  if (!sQuestions) {
    return next(new ErrorHander("Cannot found sQuestions..", 404));
  }
  try {
    const updatedsQuestion = await squestion.findByIdAndUpdate(
      id,
      {
        questionText,
        options,
        correctOptions,
        level,
      },
      { new: true }
    );

    if (!updatedsQuestion) {
      return res.status(404).json({ message: "sQuestion not found" });
    }

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updatedsQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update sQuestion" });
  }
});
