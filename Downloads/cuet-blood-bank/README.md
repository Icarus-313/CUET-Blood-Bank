# CUET Blood Bank

A donor network for CUET students — register as a donor, search for blood by group and distance, and broadcast urgent requests straight to matching donors' inboxes.

## Features

- **Donor registration restricted to CUET email** — only `@student.cuet.ac.bd` addresses (configurable) can register.
- **Public blood search** — anyone can search direct and red-cell-compatible donors by blood group, distance, and availability, no account required.
- **Profile self-service** — donors log their last donation date; a 90-day eligibility clock (configurable) is calculated automatically.
- **Live location tracking** — donors can opt in to share real-time GPS location from their dashboard (browser Geolocation API), which powers "nearest donor" search.
- **Urgent request broadcast** — marking a request "urgent" emails every eligible, available, matching-group donor within range (Nodemailer/SMTP).
- **On-demand contact reveal** — receivers provide a reason before a donor's phone/email is released; every reveal is logged and visible to the donor in their dashboard.
- **Rate limiting** on request submission and contact requests to prevent spam/abuse.

## Tech stack

Node.js, Express (MVC), MongoDB + Mongoose (with `2dsphere` geospatial indexes), JWT auth (httpOnly cookie), EJS templating, Nodemailer.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   - `MONGO_URI` — a local MongoDB (`mongodb://127.0.0.1:27017/cuet_blood_bank`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster connection string.
   - `JWT_SECRET` — replace with a long random string.
   - `ALLOWED_EMAIL_DOMAIN` — set to CUET's actual student email domain if it differs from `student.cuet.ac.bd`.
   - `SMTP_*` — SMTP credentials for sending urgent-request emails. With Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your normal password. If left blank, emails are skipped (logged to console) so you can still develop without SMTP set up.

3. **Run MongoDB** locally (`mongod`) or use Atlas (no local install needed).

4. **Start the app**
   ```bash
   npm run dev   # auto-restarts on file changes (nodemon)
   # or
   npm start
   ```
   Visit `http://localhost:3000`.

## Project structure

```
config/db.js          MongoDB connection
models/                Donor, BloodRequest, ContactRequest (Mongoose schemas)
middleware/auth.js     JWT cookie auth (attachDonor, requireAuth)
controllers/           Route logic (auth, donor, blood request)
routes/                Express routers
views/                 EJS templates (layout + pages)
public/css, public/js  Styles + client-side GPS/AJAX behavior
utils/sendEmail.js     Nodemailer wrapper
utils/constants.js     Shared blood-group list
```

## Notes on the "urgent email" flow

When a request is submitted with urgency = urgent:
1. The app finds donors with a medically compatible red-cell blood group, `available: true`, and (if the requester shared location) within roughly 3x the default search radius.
2. It filters that list down to donors who are actually eligible right now (90+ days since their last logged donation, by default).
3. It emails each of them with the request details and the requester's contact info, and records which donors were notified on the request document.

## Extending further

Ideas for a "v2" if you want to keep building:
- Email/OTP verification on registration (the schema already has an `isVerified` field, unused for now).
- Admin view to moderate requests/donors.
- SMS alerts (e.g. via Twilio) alongside email for true urgency.
- Push notifications if you wrap this as a PWA.
