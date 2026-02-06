const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "meeting_db",
  password: "1234",
  port: 5432,
});

pool.on("connect", () => {
  console.log("PostgreSQL connected successfully");
});

module.exports = pool;
