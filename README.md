# The Horizon Academy — Fees Management System (Plain PHP version)

No Laravel, no Composer, no Artisan — just PHP + PDO + MySQL. Built to
drop straight into XAMPP's `htdocs` and run.

## Stack

| Layer     | Tech                                            |
|-----------|--------------------------------------------------|
| Frontend  | HTML + CSS + JavaScript + Bootstrap 5             |
| Backend   | Plain PHP (PDO), REST-style endpoints             |
| Database  | MySQL / MariaDB                                    |

## Folder structure

```
horizon-academy-app/
├── index.html              → app shell (Bootstrap 5 + app CSS/JS)
├── css/style.css            → the app's original design system
├── js/app.js                → the app's original logic (talks to api/*.php)
├── database/
│   └── schema.sql            → run this once to create all tables + seed data
└── api/
    ├── bootstrap.php          → CORS headers + JSON helpers (included by every endpoint)
    ├── helpers.php             → settings/trash read-write helpers (JSON blobs)
    ├── config/database.php     → ⚠️ edit this: DB host/name/user/password
    ├── health.php              → GET  — health check
    ├── programs.php            → full REST: GET / GET?id= / POST / PUT?id= / DELETE?id=
    ├── students.php            → same, plus ?programId= and ?q= search filters on GET
    ├── payments.php            → same, plus ?studentId=&from=&to= filters; auto-assigns receiptNo
    ├── expenses.php            → same, plus ?from=&to=&category= filters
    ├── settings.php            → GET / PUT — app settings (JSON blob)
    ├── trash.php                → GET / PUT — trash bins (JSON blob)
    └── state.php                 → GET / PUT — **this is what the frontend actually calls**
```

## Why `state.php` *and* the other REST files?

- **`state.php`** is a single `GET`/`PUT` that loads/saves *everything* in
  one call. This is what `js/app.js` uses (same contract the original
  Node app had) — so the whole frontend works unmodified.
- **`programs.php` / `students.php` / `payments.php` / `expenses.php` /
  `settings.php` / `trash.php`** are genuine per-resource REST endpoints
  (`GET`, `POST`, `PUT`, `DELETE`) for anything else that wants to talk
  to this backend — Postman, a mobile app, another frontend.

Both layers read and write the exact same MySQL tables.

## Setup on XAMPP

1. **Copy this whole `horizon-academy-app` folder** into XAMPP's `htdocs`:
   ```
   C:\xampp\htdocs\horizon-academy-app        (Windows)
   /Applications/XAMPP/htdocs/horizon-academy-app   (Mac)
   ```

2. **Start Apache and MySQL** from the XAMPP Control Panel.

3. **Create the database.** Open `http://localhost/phpmyadmin`:
   - Click **New**, name it `horizon_academy`, collation `utf8mb4_general_ci`, create it.
   - Click the **Import** tab, choose `database/schema.sql` from this
     project, click **Go**. This creates all 5 tables and seeds the 14
     default programmes + default settings.

4. **Check the DB credentials.** Open `api/config/database.php` — the
   defaults already match XAMPP's out-of-the-box MySQL (`root`, no
   password, `127.0.0.1:3306`). If you changed your XAMPP MySQL
   password, update `DB_PASS` here.

5. **Open it in your browser:**
   ```
   http://localhost/horizon-academy-app/
   ```
   That's the whole app. No further configuration needed — the
   frontend's `fetch()` calls use relative paths (`api/state.php`, no
   leading slash), so they work no matter what subfolder you put the
   project in.

## Quick test (optional)

Visit `http://localhost/horizon-academy-app/api/health.php` — you
should see `{"ok":true}`. If instead you get a database error, it's
almost always the credentials in `api/config/database.php` or the
`horizon_academy` database not existing yet.

## API reference

| Method | Endpoint                                | Purpose                                    |
|--------|-------------------------------------------|----------------------------------------------|
| GET    | `api/health.php`                          | Health check                                |
| GET    | `api/programs.php`                        | List programmes                             |
| GET    | `api/programs.php?id=9-sci`               | One programme                               |
| POST   | `api/programs.php`                        | Create a programme                          |
| PUT    | `api/programs.php?id=9-sci`               | Update a programme                          |
| DELETE | `api/programs.php?id=9-sci`               | Delete a programme                          |
| GET    | `api/students.php`                        | List students (`?programId=`, `?q=`)        |
| GET    | `api/students.php?id=xxx`                 | One student                                 |
| POST   | `api/students.php`                        | Create a student                            |
| PUT    | `api/students.php?id=xxx`                 | Update a student                            |
| DELETE | `api/students.php?id=xxx`                 | Delete a student                            |
| GET    | `api/payments.php`                        | List payments (`?studentId=`, `?from=`, `?to=`) |
| POST   | `api/payments.php`                        | Create a payment (auto-assigns `receiptNo`) |
| PUT    | `api/payments.php?id=xxx`                 | Update a payment                            |
| DELETE | `api/payments.php?id=xxx`                 | Delete a payment                            |
| GET    | `api/expenses.php`                        | List expenses (`?from=`, `?to=`, `?category=`) |
| POST   | `api/expenses.php`                        | Create an expense                           |
| PUT    | `api/expenses.php?id=xxx`                 | Update an expense                           |
| DELETE | `api/expenses.php?id=xxx`                 | Delete an expense                           |
| GET    | `api/settings.php`                        | Get app settings                            |
| PUT    | `api/settings.php`                        | Update app settings                         |
| GET    | `api/trash.php`                           | Get trash bins                              |
| PUT    | `api/trash.php`                           | Replace trash bins                          |
| GET    | `api/state.php`                           | Get everything at once (frontend uses this) |
| PUT    | `api/state.php`                           | Replace everything at once (frontend uses this) |

All of this was tested end-to-end against a real MySQL database before
delivery: schema import, listing programmes, creating a student,
creating a payment (confirming the receipt number auto-increments
through `settings`), and a full `state.php` GET → PUT → GET round trip.

## Notes

- IDs are strings, matching what the frontend already generates
  client-side (`id_xxxxxxxx...`).
- `key_value_store` holds the `settings` object and `trash` bins as
  JSON — same idea as the original app's simple key/value table.
- If you ever want to host the frontend and this API on different
  domains, set `window.API_BASE = 'http://your-api-host/horizon-academy-app/api/'`
  before `js/app.js` loads in `index.html`. CORS is already open in
  `api/bootstrap.php`.
