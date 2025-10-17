Deployment notes — upload to WordPress file manager and embed listing page

Goal

Make the listing page work when uploaded to WordPress (no node server). Two supported approaches are provided:

A) Inline JSON embed (recommended for simplicity)
B) Upload JSON file to uploads and use relative path

Files you need to upload

- src/pages/listing-new.html  -> paste content into WP page HTML or use an iframe
- src/styles/enhanced-styles.css -> upload to the same folder or a known public URL
- src/js/listing-new.js -> upload and reference
- src/js/filter-helpers.js -> upload and reference
- src/data/all_courses.json -> upload OR embed inline

Approach A — Inline JSON (recommended)

1. Open `listing-new.html` and locate the commented block with `<script id="allCoursesData" type="application/json">`.
2. Copy the full contents of `src/data/all_courses.json` and paste inside that script tag. Save.
3. Upload the modified `listing-new.html`, `enhanced-styles.css`, `listing-new.js`, and `filter-helpers.js` to the same folder in WP file manager.
4. Create a new WP page and use the 'Custom HTML' block to paste the content of `listing-new.html`, or create an iframe that points to the uploaded HTML file.

Why this works: the listing loader first checks for inline JSON (script id `allCoursesData`) and will use it directly. This avoids CORS/permission/path problems with WP uploads.

Approach B — Upload JSON file to uploads

1. Upload `all_courses.json` to `wp-content/uploads/` (or same folder as the HTML).
2. Upload the other files (`listing-new.html`, `enhanced-styles.css`, `listing-new.js`, `filter-helpers.js`) to the same folder.
3. The loader tries multiple candidate URLs including `/wp-content/uploads/all_courses.json` and `./all_courses.json`, so it will find the data.

Debugging tips

- Open browser devtools console to see debug messages from the listing loader (it prints attempted URLs and success/failure reasons).
- If data doesn't load, paste the JSON into the inline script as in Approach A.
- Ensure the JavaScript file references in HTML point to the correct paths relative to the HTML file location.

Server testing locally

To test locally, run a simple static server from project root:

```bash
cd /workspaces/AI-all-courses-list-nanoschool
python3 -m http.server 8000
# open http://127.0.0.1:8000/src/pages/listing-new.html
```

If you want, I can prepare a single self-contained HTML file (inlining CSS and JS and embedding the JSON) so you can directly paste it into WordPress without uploading multiple files. Let me know if you'd like that single-file bundle.
