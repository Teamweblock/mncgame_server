const mongoose = require("mongoose");
const { DB_CONN } = require("../config");
const databaseConnection = async () => {
  mongoose.connect(DB_CONN);
  const db = mongoose.connection;
  db.on("error", (err) => console.log("db not connected", err));
  db.on("disconnected", () => console.log("database disconnected"));
  db.on("open", () => {
    console.log("Database connected succesfully.");
  });
};
module.exports = databaseConnection;
