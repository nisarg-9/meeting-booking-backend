This project is a backend-only meeting booking system built as part of a technical assessment.
It allows one user to create a meeting, generate a shareable booking link, and another user to select an available time slot to confirm the meeting.

The system ensures:
No double booking
Proper database consistency
Real email confirmation on successful booking

  Tech Stack
Backend: Node.js, Express.js
Database: PostgreSQL
Email: Nodemailer (Gmail SMTP)

  Application Flow
1️ Create Meeting (User 1)
    User creates a meeting with a title
    System generates a unique booking link
2️ Add Available Time Slots (User 1)
    Multiple time slots can be added for the meeting
    All slots start as AVAILABLE
3️ Share Booking Link
    Booking link is shared with another user
4️ View Meeting & Slots (User 2)
    User opens booking link
    Sees meeting details and available slots
5️ Confirm Booking (User 2)
    User selects one slot
    Slot is locked
    Meeting is confirmed
    Confirmation email is sent
    Double booking is prevented using database transactions

Key Backend Concepts Used

PostgreSQL transactions
Row-level locking using SELECT ... FOR UPDATE
Proper relational database design
Error handling for invalid links and duplicate booking
Environment-based configuration


 API Endpoints

 `POST /meetings` – Create meeting  
 `POST /meetings/:id/slots` – Add time slots  
 `GET /book/:link` – View slots  
 `POST /book/:link` – Confirm booking  