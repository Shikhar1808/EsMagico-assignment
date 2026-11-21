# NOTES

## Stack and why
**React + Express + MongoDB**, all in JavaScript, so one language runs end to end. Express serves both the API and the built React app, which means one image and one port. MongoDB is accessed through Mongoose, and the `Student` model (`server/src/models/Student.js`) is the single definition of the collection: fields, types, ranges and indexes. The CSV validator still decides what the administrator sees as a row problem. The schema is a final check before writing, because Mongoose does not run validators inside `bulkWrite`. A test makes sure the two never drift apart. Compose runs MongoDB next to the app.

## How the import works
`validateCsv()` is a pure function: buffer in, `{students, problems}` out. It is where all the rules live, and it is what the tests target. The route then upserts the valid rows in one `bulkWrite`.

**What counts as valid** follows the sample-pack README exactly. Checked against the sample pack, it reproduces the expected counts, `25/16/9` and `5000/4685/315`, and its 348 problems match the brief's sketch. Traps I found in the data, all handled and tested:

- a UTF-8 BOM, CRLF line endings, an unlisted `parent_phone` column (ignored), and rows with one field too few or too many
- `,,,,,,,,,,` rows: these have the wrong field count but are *empty*, so they are skipped, not rejected
- whitespace around values, upper-case emails, lower-case sections and IDs, `09` as a class, and `"Patel, Sahil"` and `Zoë`: all fixed up and **accepted**
- `1e3` and `0x10` as marks: `Number()` would accept these, so I use a strict decimal pattern instead
- `31/02/2012`: JavaScript's `Date` silently rolls it into March, so the date is round-trip checked
- dates in `MM-DD-YYYY` and `DD.MM.YYYY` (rejected rather than guessed), and `tomorrow`, 1970 and future dates
- a stray `"` inside a field, such as `=HYPERLINK("x")`, made the CSV parser reject the *whole file*. I switched on relaxed quotes, so it now fails only that row.

**What the admin sees:** rows read, imported (new / updated / unchanged) and rejected, then a table of every problem with its row number, student ID, field, the raw value and a plain-English reason (with the error code shown small), plus a CSV download. Excel formula characters in the download are escaped. A row with three problems shows all three, so it can be fixed in one pass.

**Duplicates.** Within one file, the first row with an ID claims it, **even if that row is invalid**. The later row is rejected as `DUPLICATE_ID`. This is what the README says, and the expected counts confirm it. The trade-off is that a later valid row doesn't rescue the student, but silently picking "the valid one" would hide a conflict the admin should see.

**Across files**, I upsert by `student_id`: the newest file wins. Unchanged rows are not rewritten, so uploading the same file again reports `0 new, 0 updated, N unchanged` and shows a banner saying the file looks like it was imported before. Students missing from a new file are **not** deleted. A partial file (for example one class) shouldn't wipe the others.

**Bad, large and slow files.** Bad files are rejected before anything is written, with a specific message: empty, binary or `.xlsx`, not UTF-8, missing columns (listed by name), or broken quoting. Uploads are capped at 10 MB (about 100k rows) and get a 413 with a message. 5,000 rows import in well under a second, and the UI shows a spinner and disables the button while the import runs. Unexpected errors return a generic 500 and are logged, and the process stays up.

## Grading scheme
Percentage = total ÷ 500. **A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35.** **Pass = at least 35 in every subject.** A failed subject is not hidden by a good average, so a student can have an A and still FAIL. That is deliberate, and the report highlights the failing subject. Results are computed at import time and stored, so the list can show them without recomputing.

## Assumptions
- "5 to 25 years old today" uses whole years, inclusive, and the server's date, so the same file can give slightly different counts on a different day. Tests pin the date.
- The class and age of a student are not cross-checked (a 6-year-old in class 12 passes). The rules don't ask for it, and it could reject real data.
- There is a single administrator, so there is no login. This is the first thing to add before real use.

## What I left out, and what I'd do next
1. **Authentication and roles.** The portal exposes student personal data with no login.
2. **Import history.** Results of an import are shown once and can be downloaded as CSV, but are not stored. Storing them only makes sense with a screen that reads them, so I left both out.
3. **Background import jobs.** Validation runs synchronously, which is fine up to the 10 MB cap. Larger files would need streaming parsing with a progress bar.
4. **Search at scale.** Search uses a case-insensitive regex, which is fine for thousands of students but scans the collection. A MongoDB text or Atlas Search index would be needed for much larger data.
5. **Integration tests against real MongoDB** (for example with testcontainers). The current API tests use an in-memory stand-in for `bulkWrite`.
6. **Browser end-to-end tests** (Playwright) for the three screens.
