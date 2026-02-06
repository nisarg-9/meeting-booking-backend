require("dotenv").config();   // ✅ MUST be first

const crypto = require("crypto");
const express = require("express");
const app = express();
const pool = require("./config/db");
const transporter = require("./config/mailer");

function generateBookingToken() {
  return crypto.randomBytes(16).toString("hex");
}

app.use(express.json());


app.get("/health", async (req, res) => {
  res.json({ status: "OK" });
});

app.post("/users", async (req, res) => {
  const { name, email } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/meetings", async (req, res) => {
  const { title, meeting_time, user_id } = req.body;
  const bookingToken = generateBookingToken();

  try {
    const result = await pool.query(
      `INSERT INTO meetings (title, meeting_time, user_id, booking_token)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, meeting_time, user_id, bookingToken]
    );

    res.status(201).json({
      meeting: result.rows[0],
      booking_link: `http://localhost:5000/book/${bookingToken}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/meetings/:id/slots", async (req, res) => {
  const meetingId = req.params.id;
  const { slots } = req.body;
  // slots = [{ start_time, end_time }, ...]

  try {
    const createdSlots = [];

    for (const slot of slots) {
      const result = await pool.query(
        `INSERT INTO meeting_slots (meeting_id, start_time, end_time)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [meetingId, slot.start_time, slot.end_time]
      );

      createdSlots.push(result.rows[0]);
    }

    res.status(201).json(createdSlots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




app.get("/meetings", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         m.id,
         m.title,
         m.meeting_time,
         m.created_at,
         u.id AS user_id,
         u.name AS user_name,
         u.email AS user_email
       FROM meetings m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.id ASC`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/book/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const meetingResult = await pool.query(
      "SELECT * FROM meetings WHERE booking_token = $1",
      [token]
    );

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid booking link" });
    }

    const meeting = meetingResult.rows[0];

    const slotsResult = await pool.query(
      "SELECT * FROM meeting_slots WHERE meeting_id = $1 AND status = 'AVAILABLE'",
      [meeting.id]
    );

    res.json({
      meeting,
      available_slots: slotsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/book/:token/confirm", async (req, res) => {
  const { token } = req.params;
  const { slot_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Lock meeting
    const meetingResult = await client.query(
      "SELECT * FROM meetings WHERE booking_token = $1 AND status = 'OPEN' FOR UPDATE",
      [token]
    );

    if (meetingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Meeting already confirmed or invalid" });
    }

    const meeting = meetingResult.rows[0];

    // 2. Lock slot
    const slotResult = await client.query(
      "SELECT * FROM meeting_slots WHERE id = $1 AND meeting_id = $2 AND status = 'AVAILABLE' FOR UPDATE",
      [slot_id, meeting.id]
    );

    if (slotResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Slot not available" });
    }

    // 3. Book slot
    await client.query(
      "UPDATE meeting_slots SET status = 'BOOKED' WHERE id = $1",
      [slot_id]
    );

    // 4. Confirm meeting
    await client.query(
      "UPDATE meetings SET status = 'CONFIRMED' WHERE id = $1",
      [meeting.id]
    );

    await client.query("COMMIT");

    await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: "user1@example.com, user2@example.com",
  subject: "Meeting Confirmed",
  text: `Your meeting has been confirmed successfully.
  Meeting ID: ${meeting.id}
  Slot ID: ${slot_id}`
  });

    res.json({
      message: "Meeting confirmed successfully",
      meeting_id: meeting.id,
      slot_id
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
