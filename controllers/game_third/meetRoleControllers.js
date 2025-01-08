const Role = require("../../model/thirdGame/meetgameRole");
const ErrorHander = require("../../utils/errorhandaler");
const catchAsyncErrors = require("../../middleware/catchAsyncErrors");

// create Roles
module.exports.creatmeetRole = catchAsyncErrors(
  async (req, res, next) => {
    const rolesData = req.body; // Array of role objects
    try {
      const roles = await Role.insertMany(rolesData);

      if (!roles || roles.length === 0) {
        return next(new ErrorHander("Roles cannot be created...", 404));
      }

      res.status(200).json({
        success: true,
        roles,
      });
    } catch (error) {
      next(new ErrorHander("Error occurred while creating roles", 500));
    }
  }
);

//get all Roles
module.exports.getallmeetRoles = catchAsyncErrors(async (req, res) => {
  try {
    const Roles = await Role.find();

    res.status(200).json({
      success: true,
      Roles,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

//getsingleRoles
module.exports.getsinglemeetRoles = catchAsyncErrors(
  async (req, res, next) => {
    let id = req.query.id;

    const Roles = await Role.find({ _id: id });

    if (!Roles) {
      return next(new ErrorHander("Roles not found", 404));
    } else {
      res.status(200).json({
        success: true,
        Roles,
      });
    }
  }
);

//Delete Role
module.exports.deletemeetRole = catchAsyncErrors(
  async (req, res, next) => {
    let id = req.query.id;
    try {
      const data = await Role.findByIdAndDelete(id);
      if (!data) {
        return next(new ErrorHander("Roles not found", 404));
      }
      return res
        .status(200)
        .json({ message: "Roles deleted successfully" });
    } catch (err) {
      return res.status(500).json({ err });
    }
  }
);

// Update Role
module.exports.updatemeetRoles = catchAsyncErrors(
  async (req, res, next) => {
    let id = req.query.id;
    const { role } = req.body;
    let Roles = await Role.findById(id);

    if (!Roles) {
      return next(new ErrorHander("Cannot found Roles..", 404));
    }
    try {
      const updatedRole = await Role.findByIdAndUpdate(
        id,
        {
          role,
        },
        { new: true }
      );

      if (!updatedRole) {
        return res.status(404).json({ message: "Role not found" });
      }

      res.status(200).json({
        success: true,
        msg: "Updated successfully...",
        updatedRole,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  }
);
