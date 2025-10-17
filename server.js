const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const slugify = require('slugify');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from src directory
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/ai', express.static(path.join(__dirname, 'ai')));
app.use('/admin-static', express.static(path.join(__dirname, 'admin-static')));

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/pages/index.html'));
});

app.get('/listing', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/pages/listing-new.html'));
});

// API endpoints for course data
app.get('/api/courses', (req, res) => {
    const courses = loadJson(ALL_COURSES_FILE);
    res.json(courses || []);
});

app.get('/api/courses/grouped', (req, res) => {
    const courses = loadJson(ALL_COURSES_FILE);
    const grouped = rebuildGroupsFromAllCourses(courses);
    res.json(grouped || {});
});

const ALL_COURSES_FILE = path.join(__dirname, 'src/data/all_courses.json');
const TEMPLATE_FILE = path.join(__dirname, 'src/data/course_full_template.json');

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch (e) {
    return null;
  }
}

function rebuildGroupsFromAllCourses(allCourses) {
  const grouped = { industryTracks: [], regularTracks: [] };
  function findOrCreate(tracksArr, trackName, isIndustry) {
    let t = tracksArr.find(x => x.track === trackName);
    if (!t) { t = { track: trackName, isIndustryTrack: !!isIndustry, domains: [] }; tracksArr.push(t); }
    return t;
  }
  allCourses.forEach(course => {
    const trackName = course.track || 'Other';
    const domainName = course.domain || 'General';
    const isIndustry = /industry|ai for|advanced/i.test(trackName || '');
    const target = isIndustry ? grouped.industryTracks : grouped.regularTracks;
    const trackObj = findOrCreate(target, trackName, isIndustry);
    let domainObj = trackObj.domains.find(d => d.name === domainName);
    if (!domainObj) { domainObj = { name: domainName, courses: [], courseCount: 0 }; trackObj.domains.push(domainObj); }
    domainObj.courses.push({
      id: course.id,
      title: course.title,
      level: course.level,
      duration: course.duration,
      tool: course.tool || course.tools,
      domain: domainName,
      track: trackName,
      status: course.status || 'Active',
      enrollmentUrl: course.enrollmentUrl,
      mainPageUrl: course.mainPageUrl,
      description: course.description || '',
      instructor: course.instructors && course.instructors.length ? (course.instructors[0].name || course.instructors[0]) : (course.instructor || ''),
      rating: course.rating || (course.aggregateRating && course.aggregateRating.ratingValue) || null,
      students: course.students || 0
    });
    domainObj.courseCount = domainObj.courses.length;
  });
  fs.writeFileSync(path.join(__dirname, 'courses_grouped.json'), JSON.stringify(grouped, null, 2));
  return grouped;
}

app.get('/admin', (req, res) => {
  const allCourses = loadJson(ALL_COURSES_FILE) || [];
  const template = loadJson(TEMPLATE_FILE) || [];
  res.sendFile(path.join(__dirname, 'admin-static', 'admin.html'));
});

app.get('/admin/api/courses', (req, res) => {
  const allCourses = loadJson(ALL_COURSES_FILE) || [];
  res.json(allCourses.map(c => ({ id: c.id, title: c.title })));
});

app.get('/admin/api/course', (req, res) => {
  const id = req.query.id;
  const allCourses = loadJson(ALL_COURSES_FILE) || [];
  const course = allCourses.find(c => c.id === id);
  res.json(course || {});
});

app.post('/admin/api/generate', (req, res) => {
  const payload = req.body;
  // Merge with existing course data
  const allCourses = loadJson(ALL_COURSES_FILE) || [];
  const courseIndex = allCourses.findIndex(c => c.id === payload.id);
  let merged = {};
  if (courseIndex !== -1) {
    merged = { ...allCourses[courseIndex], ...payload };
    allCourses[courseIndex] = merged;
  } else {
    merged = payload;
    allCourses.push(merged);
  }

  // Backup existing all_courses.json then save updated all_courses.json
  try {
    if (fs.existsSync(ALL_COURSES_FILE)) {
      const backupsDir = path.join(__dirname, 'backups');
      fs.mkdirSync(backupsDir, { recursive: true });
      const bak = path.join(backupsDir, 'all_courses.json.bak-' + Date.now());
      fs.copyFileSync(ALL_COURSES_FILE, bak);
      // Keep only last 10 backups
      const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('all_courses.json.bak-')).map(f => ({ f, t: fs.statSync(path.join(backupsDir, f)).mtimeMs })).sort((a,b)=>b.t-a.t);
      const toDelete = files.slice(10);
      toDelete.forEach(x => { try { fs.unlinkSync(path.join(backupsDir, x.f)); } catch(e){} });
    }
  } catch (e) { console.warn('Backup failed', e.message); }
  fs.writeFileSync(ALL_COURSES_FILE, JSON.stringify(allCourses, null, 2));

  // Create ai folder if missing
  const outDir = path.join(__dirname, 'ai', slugify(merged.title || merged.id, { lower: true }));
  fs.mkdirSync(outDir, { recursive: true });

  // Render HTML using EJS template
  const templateHtml = fs.readFileSync(path.join(__dirname, 'admin-static', 'course-template.ejs'), 'utf8');
  const html = ejs.render(templateHtml, { course: merged });

  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  // Rebuild grouped JSON to keep it in sync
  try {
    rebuildGroupsFromAllCourses(allCourses);
  } catch (e) { console.warn('Rebuild groups failed:', e.message); }

  res.json({ success: true, path: `/ai/${slugify(merged.title || merged.id, { lower: true })}/` });
});

// Preview: render EJS with provided course data and return HTML (no file write)
app.post('/admin/api/preview', (req, res) => {
  const payload = req.body || {};
  try {
    // Provide safe defaults to avoid runtime errors in template when fields are missing
    const safeCourse = Object.assign({}, payload);
    safeCourse.title = safeCourse.title || safeCourse.id || 'Untitled Course';
    safeCourse.description = safeCourse.description || safeCourse.shortDescription || '';
    safeCourse.mainPageUrl = safeCourse.mainPageUrl || (`/ai/courses/${slugify(safeCourse.title || 'course', { lower: true })}/`);
    safeCourse.pricing = safeCourse.pricing || {};
    safeCourse.pricing.lms = safeCourse.pricing.lms || { usd: 0, inr: 0 };
    safeCourse.pricing.lms_video = safeCourse.pricing.lms_video || { usd: 0, inr: 0 };
    safeCourse.pricing.lms_video_live = safeCourse.pricing.lms_video_live || { usd: 0, inr: 0 };
    safeCourse.syllabus = Array.isArray(safeCourse.syllabus) ? safeCourse.syllabus : [];
    safeCourse.projects = Array.isArray(safeCourse.projects) ? safeCourse.projects : [];
    safeCourse.testimonials = Array.isArray(safeCourse.testimonials) ? safeCourse.testimonials : [];
    safeCourse.faqs = Array.isArray(safeCourse.faqs) ? safeCourse.faqs : [];
    safeCourse.plans = Array.isArray(safeCourse.plans) ? safeCourse.plans : [];
    safeCourse.students = safeCourse.students || 0;
    safeCourse.level = safeCourse.level || '';

    const templateHtml = fs.readFileSync(path.join(__dirname, 'admin-static', 'course-template.ejs'), 'utf8');
    const html = ejs.render(templateHtml, { course: safeCourse });
    res.send(html);
  } catch (e) {
    res.status(500).json({ error: 'Preview render failed', details: e.message });
  }
});

// Rebuild grouped courses JSON from all_courses.json
app.post('/admin/api/rebuild-groups', (req, res) => {
  try {
    const allCourses = loadJson(ALL_COURSES_FILE) || [];
    const grouped = { industryTracks: [], regularTracks: [] };

    // Helper to find or create track object
    function findOrCreate(tracksArr, trackName, isIndustry) {
      let t = tracksArr.find(x => x.track === trackName);
      if (!t) {
        t = { track: trackName, isIndustryTrack: !!isIndustry, domains: [] };
        tracksArr.push(t);
      }
      return t;
    }

    allCourses.forEach(course => {
      const trackName = course.track || 'Other';
      const domainName = course.domain || 'General';
      // Heuristic: treat as industry track if track contains certain keywords
      const isIndustry = /industry|ai for|advanced/i.test(trackName || '');
      const target = isIndustry ? grouped.industryTracks : grouped.regularTracks;
      const trackObj = findOrCreate(target, trackName, isIndustry);
      let domainObj = trackObj.domains.find(d => d.name === domainName);
      if (!domainObj) { domainObj = { name: domainName, courses: [], courseCount: 0 }; trackObj.domains.push(domainObj); }
      // Push a lightweight course summary
      domainObj.courses.push({
        id: course.id,
        title: course.title,
        level: course.level,
        duration: course.duration,
        tool: course.tool || course.tools,
        domain: domainName,
        track: trackName,
        status: course.status || 'Active',
        enrollmentUrl: course.enrollmentUrl,
        mainPageUrl: course.mainPageUrl,
        description: course.description || '',
        instructor: course.instructors && course.instructors.length ? (course.instructors[0].name || course.instructors[0]) : (course.instructor || ''),
        rating: course.rating || (course.aggregateRating && course.aggregateRating.ratingValue) || null,
        students: course.students || 0
      });
      domainObj.courseCount = domainObj.courses.length;
    });

    fs.writeFileSync(path.join(__dirname, 'courses_grouped.json'), JSON.stringify(grouped, null, 2));
    res.json({ success: true, message: 'courses_grouped.json rebuilt', path: '/courses_grouped.json' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Backups: list available backups
app.get('/admin/api/backups', (req, res) => {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) return res.json([]);
    const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('all_courses.json.bak-')).map(f => ({ name: f, path: '/backups/' + f, mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs }));
    // sort desc
    files.sort((a,b)=>b.mtime - a.mtime);
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get a backup file contents
app.get('/admin/api/backups/:name', (req, res) => {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    const name = req.params.name;
    const full = path.join(backupsDir, name);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(full, 'utf8');
    res.send(content);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Restore a named backup into all_courses.json and rebuild groups
app.post('/admin/api/backups/restore', (req, res) => {
  try {
    const name = req.body && req.body.name;
    if (!name) return res.status(400).json({ error: 'name required' });
    const backupsDir = path.join(__dirname, 'backups');
    const full = path.join(backupsDir, name);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });
    const data = fs.readFileSync(full, 'utf8');
    // validate JSON
    const parsed = JSON.parse(data);
    fs.writeFileSync(ALL_COURSES_FILE, JSON.stringify(parsed, null, 2));
    // rebuild groups
    rebuildGroupsFromAllCourses(parsed);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
});
