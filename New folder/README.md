NanoSchool — Course Page Generator (Admin)

Overview
--------
This lightweight admin helps you generate static course pages under `/ai/<slug>/index.html` from the canonical `all_courses.json` dataset. It includes:

- An Express-based admin server (`server.js`) with endpoints to preview and generate pages.
- An admin UI at `/admin` for selecting a course, editing missing fields, previewing, and generating pages.
- Grouping logic that writes `courses_grouped.json` and a helper to rebuild it.
- Backups of `all_courses.json` stored in `backups/` (latest 10 kept).
- Templates in `admin-static/` (the EJS template is `course-template.ejs`).

Files & output
---------------
- Source data: `all_courses.json`
- Grouped data: `courses_grouped.json`
- Generated pages: `ai/<slug>/index.html`
- Template: `admin-static/course-template.ejs`
- Admin UI: `admin-static/admin.html`
- Backups: `backups/all_courses.json.bak-<timestamp>`

Requirements
------------
Node.js (tested with Node 18+). The project uses only lightweight dependencies installed via npm.

Quick start
-----------
Open a terminal and run:

```bash
# from the repository root
cd "New folder"
# install dependencies (if not already done)
npm install
# start server
node server.js
```

The admin UI will be available at:

http://localhost:3000/admin

Usage — Admin UI
-----------------
- Select a course from the drop-down. The form auto-fills fields from `all_courses.json`.
- Edit or add missing fields. For structured fields (syllabus, plans, pricing, testimonials), paste JSON into the textareas or use the helper buttons.
- Click "Preview" to render the page in the embedded iframe (does not write files).
- Click "Generate Page" to save changes to `all_courses.json`, create a backup, rebuild grouped data, and write the static HTML to `/ai/<slug>/index.html`.
- Click "Rebuild Groups" to regenerate `courses_grouped.json` from `all_courses.json` without generating pages.

Important endpoints (for automation)
-----------------------------------
- GET /admin/api/courses
  - Returns minimal list of courses: [{ id, title }]
- GET /admin/api/course?id=<courseId>
  - Returns the full course object from `all_courses.json` for the given id.
- POST /admin/api/preview
  - Body: JSON course object (partial allowed). Returns rendered HTML (no file write).
- POST /admin/api/generate
  - Body: JSON course object (merged into `all_courses.json`). Writes `/ai/<slug>/index.html`, creates a backup, and rebuilds `courses_grouped.json`.
- POST /admin/api/rebuild-groups
  - No body required. Rebuilds `courses_grouped.json` from `all_courses.json`.

Example curl commands
---------------------
Preview a payload:

```bash
curl -X POST http://localhost:3000/admin/api/preview \
  -H 'Content-Type: application/json' \
  -d '{"title":"Preview Course","description":"Quick preview","duration":{"weeks":4}}'
```

Generate a course (this will overwrite `all_courses.json` and write the page):

```bash
curl -X POST http://localhost:3000/admin/api/generate \
  -H 'Content-Type: application/json' \
  -d @course-payload.json
```

Rebuild grouped data:

```bash
curl -X POST http://localhost:3000/admin/api/rebuild-groups
```

Notes and recommendations
-------------------------
- Styles & scripts: generated pages expect your site CSS/JS at `/1.css` and `/1.js` (the template references those root-relative paths). If your assets live elsewhere, update `admin-static/course-template.ejs`.
- Backups: backups are saved in `backups/` and the server keeps the latest 10 files. You can restore a backup by copying the desired `all_courses.json.bak-<timestamp>` to `all_courses.json` and rebuilding groups.
- Large datasets: rebuilding groups is synchronous and may take several seconds for very large `all_courses.json` files. If this becomes slow, I can make rebuild run asynchronously and add a status endpoint.

Troubleshooting
---------------
- If the admin UI shows "Preview failed" or returns an error, check `server.log` for stack traces.
- If routes return 404, ensure `server.js` is running and listening on the expected port (default 3000).

What I can implement next
------------------------
- Asynchronous rebuild with a job status endpoint
- Backup browsing + restore UI in the admin
- Form validation and nicer JSON editors for structured fields (syllabus, plans)
- Sync CSS class names to your `1.css` if you want different utilities

Contact
-------
If you want any of the next items implemented, tell me which and I'll do it next.
