require("dotenv").config();

const configSchema = {
  PORT: process.env.PORT,
  DB_CONN: process.env.DB_CONN_STR,
  JWT_ACCESS_TIME: process.env.JWT_ACCESS_TIME,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  PUBLISHER_KEY: process.env.PUBLISHER_KEY,
  SECRET_KEY: process.env.SECRET_KEY,
};
module.exports = configSchema;
