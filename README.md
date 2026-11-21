# Student Results Portal

A school administrator uploads a messy CSV of term results. The portal imports the valid rows, explains in plain English what was wrong with each rejected row, and lets the administrator search any student and open their report card.

**Stack:** React (Vite, Tailwind CSS) · Node.js / Express · MongoDB (Mongoose)

The reasoning behind the main decisions (validation rules, duplicates, re-uploads, grading, what was left out) is in **[NOTES.md](NOTES.md)**.

---

## Quick start

You need **Docker** with Compose.

```bash
docker compose up --build
```

Open **http://localhost:8080** and upload a CSV on the **Import** page.

- The app waits for MongoDB to be healthy before it starts.
- Data is kept in the `mongo-data` volume. `docker compose down -v` deletes it.

**Without Compose:** the [`Dockerfile`](Dockerfile) builds the client and API into one image. Point it at any MongoDB:

```bash
docker build -t results-portal .
docker run -p 8080:8080 -e MONGO_URL=mongodb://<host>:27017/results_portal results-portal
```

## Screens

| Screen | URL | What it does |
|---|---|---|
| Overview | `/` | Pass rate, student count, average score and failures, with charts for grade distribution, pass rate by class and subject averages. Every chart has a table view. |
| Import | `/import` | Pick or drag in a CSV. Shows rows read, imported (new / updated / unchanged) and rejected, and lists every problem with its row number, field, value and reason. The problem list can be downloaded as a CSV. |
| Students | `/students` | Search by name or ID, filter by class, page through results. Includes loading, empty, "no match" and error states. The URL keeps the search, so links and the back button work. |
| Report | `/students/:id` | Details, marks per subject, total, percentage, grade and pass/fail, plus a **Print report** button. An unknown ID shows "Student not found". |

**Grading:** A ≥ 80%, B ≥ 65%, C ≥ 50%, D ≥ 35%, F below. A student passes only with **at least 35 in every subject**.

## How an import behaves

- **A bad row** (missing name, `"eighty"` as a mark, duplicate ID, wrong number of fields, …) is skipped and reported. Every valid row is still imported.
- **A bad file** (empty, missing columns, not UTF-8, binary or `.xlsx`, broken quoting, over 10 MB) is rejected as a whole with one clear message, and nothing is written.
- **Uploading again** updates students by `student_id`. Uploading the same file twice reports every row as *unchanged*. Students missing from a new file are kept.

With the provided sample pack: `students_small.csv` gives **25 read / 16 imported / 9 rejected**, and `students_sample.csv` gives **5,000 / 4,685 / 315**.

## Generate test data

The seed script writes a realistic messy CSV (BOM, CRLF, bad dates, `N/A` marks, duplicate IDs, wrong field counts, …) and can upload it:

```bash
# inside the running container
docker compose exec app node scripts/seed.js --rows 5000 --upload

# or from your machine (Node 22+)
cd server && npm install
npm run seed -- --rows 5000 --upload --url http://localhost:8080
```

| Option | Default | Meaning |
|---|---|---|
| `--rows N` | `5000` | number of student rows |
| `--messy R` | `0.07` | share of rows that are broken (0 to 1) |
| `--seed N` | random | same seed gives the same file |
| `--out FILE` | OS temp folder | where to write the CSV |
| `--upload` | off | send the file to the app after writing it |
| `--url URL` | `http://localhost:8080` | app to upload to |

## Tests

```bash
cd server && npm install && npm test
```

Runs with Node's built-in test runner and needs **no database**. The tests cover:

- **Every column rule and its edges:** ages exactly 5 and 25, marks of 0, 100 and 100.5, `1e3`, `31/02/2012`, `--` as a name, …
- **File rules:** BOM, CRLF, any column order or case, extra columns, blank and all-empty rows, wrong field counts, quoted commas and line breaks, row numbering
- **Duplicates:** the first row claims an ID even if that row is itself invalid
- **Bad files and bad requests:** each one gets the right status and error code, and the server keeps running
- **Re-uploads:** the same file gives 0 new and N unchanged, and a changed mark counts as updated
- **Database failures:** an outage gives 503, a duplicate key gives 409, and an unexpected error gives a 500 that doesn't leak details
- **Validator and schema:** everything the CSV validator accepts also passes the Mongoose `Student` schema
- **The official sample pack**, if you copy it into `./data/`. It is confidential, so it isn't committed, and those tests are skipped without it.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `MONGO_URL` | `mongodb://localhost:27017/results_portal` | MongoDB connection string |
| `WEB_CONCURRENCY` | number of CPU cores (Compose sets `2`) | worker processes. A crashed worker is replaced automatically. `1` runs a single process. |

## Local development

```bash
docker run -d -p 27017:27017 mongo:7                         # or any local MongoDB
cd server && npm install && WEB_CONCURRENCY=1 npm start      # API on :8080
cd client && npm install && npm run dev                      # UI on :5173, forwards /api to :8080
```

## API

| Method | Path | Returns |
|---|---|---|
| `POST` | `/api/imports` | multipart field `file`. Returns `{ rows_read, imported, created, updated, unchanged, rejected, problems[] }` |
| `GET` | `/api/students?q=&grade_level=&page=&limit=` | `{ items, total, page, limit }`. `q` matches name or ID, ignoring case. `limit` is at most 100. |
| `GET` | `/api/students/:id` | one student, or `404` |
| `GET` | `/api/stats` | figures for the overview: pass rate, average, grade counts, per-class pass rates, subject averages |

Rejected rows are **not** HTTP errors. The import returns `200`, and each problem in `problems[]` has its own code: `MISSING_REQUIRED`, `INVALID_FORMAT`, `OUT_OF_RANGE`, `DUPLICATE_ID` or `WRONG_FIELD_COUNT`.

**Errors** always look like `{ "error": "<message safe to show the administrator>", "code": "<STABLE_CODE>" }`:

| Status | Code(s) | When |
|---|---|---|
| 400 | `NO_FILE` · `INVALID_UPLOAD` · `BAD_REQUEST` | no file; wrong form field or several files; malformed URL |
| 404 | `STUDENT_NOT_FOUND` · `NOT_FOUND` | unknown student; unknown API path |
| 409 | `DUPLICATE_KEY` | database unique-key conflict |
| 413 | `FILE_TOO_LARGE` | upload over 10 MB |
| 422 | `EMPTY_FILE` · `MISSING_COLUMNS` · `MALFORMED_CSV` · `NOT_UTF8` · `UTF16_FILE` · `BINARY_FILE` | the file can't be imported; nothing is written |
| 500 | `INTERNAL_ERROR` | unexpected bug; details are logged on the server only |
| 503 | `DB_UNAVAILABLE` | MongoDB unreachable. Fails within 5 s and sends `Retry-After: 5` |

## Project layout

```
server/
  server.js              process: clustering, start, graceful shutdown, crash handling
  src/
    app.js               Express app + initApp() / closeApp() (database connection)
    config/              settings from environment variables
    db/                  Mongoose connection and indexes
    models/Student.js    the students collection: fields, types, ranges, indexes
    routes/              /api/imports, /api/students
    controllers/         read the request, call a service, send the response
    services/            import (validate, then upsert), student queries, overview stats
    middlewares/         CSV upload limits, 404 and error handling
    helpers/
      csvValidator.js    every file and row rule; the core of the import
      grading.js         total, percentage, grade, pass/fail
      AppError.js        errors with an HTTP status and code
  scripts/seed.js        messy data generator and uploader
  test/                  tests
client/                  React + Vite + Tailwind CSS
  src/pages/             Overview, Import, Students, StudentReport
  src/components/        charts (no chart library), page header
Dockerfile               builds client + API into one image
docker-compose.yml       app + MongoDB
```
