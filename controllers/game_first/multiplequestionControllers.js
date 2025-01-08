const Question = require("../../model/FirstGame/multipleQuestion.model");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");

// create Questions
module.exports.creatmultipleQuestion = catchAsyncErrors(async (req, res, next) => {
  const questionsData = req.body; // Array of question objects
  try {
    const questions = await Question.insertMany(questionsData);

    if (!questions || questions.length === 0) {
      return next(new ErrorHander("Questions cannot be created...", 404));
    }

    res.status(200).json({
      success: true,
      questions,
    });
  } catch (error) {
    next(new ErrorHander("Error occurred while creating questions", 500));
  }
});

//get all Questions
module.exports.getallmultipleQuestions = catchAsyncErrors(async (req, res) => {
  try {
    const Questions = await Question.find();

    res.status(200).json({
      success: true,
      Questions,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

//getsingleQuestions
module.exports.getsinglemultipleQuestions = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;

  const Questions = await Question.find({ _id: id });

  if (!Questions) {
    return next(new ErrorHander("Questions not found", 404));
  } else {
    res.status(200).json({
      success: true,
      Questions,
    });
  }
});

//Delete Question
module.exports.deletemultipleQuestion = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  try {
    const data = await Question.findByIdAndDelete(id);
    if (!data) {
      return next(new ErrorHander("Questions not found", 404));
    }
    return res.status(200).json({ message: "Questions deleted successfully" });
  } catch (err) {
    return res.status(500).json({ err });
  }
});

// Update Question
module.exports.updatemultipleQuestions = catchAsyncErrors(async (req, res, next) => {
  let id = req.query.id;
  const { question, answer, level } = req.body;
  let Questions = await Question.findById(id);

  if (!Questions) {
    return next(new ErrorHander("Cannot found Questions..", 404));
  }
  try {
    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      {
        question,
        answer,
        level,
      },
      { new: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({
      success: true,
      msg: "Updated successfully...",
      updateQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update question" });
  }
});
