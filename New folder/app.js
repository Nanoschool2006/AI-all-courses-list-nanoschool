const DATA_URL = "./all_courses.json";
let allCourses = [];
let filteredCourses = [];
let currentPage = 1;
const perPage = 12;
let currentView = "grid";

document.addEventListener("DOMContentLoaded", () => initSite());

async function initSite() {
  // When served via the file protocol the browser blocks fetch for local JSON files.
  // In that case fall back to the preloaded global variable.
  if (window.location.protocol === 'file:' && window.allCoursesData) {
    allCourses = window.allCoursesData;
  } else {
    try {
      const res = await fetch(DATA_URL);
      allCourses = await res.json();
    } catch (error) {
      if (window.allCoursesData) {
        allCourses = window.allCoursesData;
      } else {
        console.error("Failed to load courses:", error);
        return;
      }
    }
  }
  // Initialize state and UI
  filteredCourses = [...allCourses];
  injectStructuredData();
  populateFilters();
  setupEventListeners();
  renderCourses();
  updateStats();
}

/** Injects schema.org structured data into the page for SEO */
function injectStructuredData() {
  if (!allCourses.length) return;
  const courses = allCourses.map(c => ({
    "@type": "Course",
    "name": c.title,
    "description": c.description || "",
    "provider": { "@type": "Organization", "name": "AI Courses Hub" },
    "timeRequired": c.duration,
    "courseCode": c.id,
    "educationalLevel": c.level
  }));
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "AI Courses Hub",
    "url": "",
    "description": "Global platform for advanced AI and Quantum Computing courses.",
    "hasCourse": courses
  });
  document.head.appendChild(script);
}

/** Populate dynamic select options for tool, domain, track filters */
function populateFilters() {
  const tools = [...new Set(allCourses.map(c => c.tool).filter(Boolean))];
  const domains = [...new Set(allCourses.map(c => c.domain).filter(Boolean))];
  const tracks = [...new Set(allCourses.map(c => c.track).filter(Boolean))];
  const statuses = [...new Set(allCourses.map(c => c.status).filter(Boolean))];
  populateSelect('toolFilter', tools);
  populateSelect('domainFilter', domains);
  populateSelect('trackFilter', tracks);
  populateSelect('statusFilter', statuses);
}

function populateSelect(id, opts) {
  const sel = document.getElementById(id);
  while (sel.options.length > 1) {
    sel.remove(1);
  }
  opts.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  });
}

/** Setup various UI event listeners */
function setupEventListeners() {
  document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
  document.getElementById('clearFilters')?.addEventListener('click', clearAllFilters);
  document.getElementById('sortBy')?.addEventListener('change', sortCourses);
  document.getElementById('gridView')?.addEventListener('click', () => toggleView('grid'));
  document.getElementById('listView')?.addEventListener('click', () => toggleView('list'));
  document.getElementById('titleFilter')?.addEventListener('input', debounce(applyFilters, 500));
  document.getElementById('levelFilter')?.addEventListener('change', applyFilters);
  document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
  document.querySelectorAll('.duration-filter').forEach(cb => cb.addEventListener('change', applyFilters));
}

/** Debounce helper to limit rapid calls */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** Convert a duration string like "6 Weeks" to numeric weeks */
function weeksToNum(duration) {
  const match = (duration || '').match(/(\d+)/);
  return match ? parseInt(match[0], 10) : 0;
}

/** Load courses: prefer window.coursesData (from all_courses.js). If missing, try fetch('all_courses.json'). */
async function loadCourses() {
  let data = window.coursesData;
  if (Array.isArray(data) && data.length) return data;
  const noResultsEl = document.getElementById('noResults');
  try {
    const resp = await fetch('all_courses.json', {cache: 'no-store'});
    if (!resp.ok) throw new Error('Failed to fetch all_courses.json');
    data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No course data found in JSON');
    return data;
  } catch (err) {
    console.error('Course data load error:', err);
    if (noResultsEl) {
      noResultsEl.classList.remove('hidden');
      noResultsEl.textContent = 'Error loading course data. Check the console for details.';
    }
    return [];
  }
}

/** Normalize status values to canonical keys used by the UI/stats */
function normalizeStatus(raw) {
  if (raw === null || raw === undefined) return 'Upcoming';
  const s = String(raw).trim();
  if (s === '') return 'Upcoming'; // default for missing statuses

  const lower = s.toLowerCase();

  // Emoji-aware checks (many datasets use emoji prefixes)
  if (s.startsWith('🟢') || lower.includes('active') || lower.includes('existing') || lower.includes('high')) return 'Active';
  if (s.startsWith('🆕') || s.startsWith('🟡') || lower.includes('upcoming') || lower.includes('new') || lower.includes('coming')) return 'Upcoming';
  if (lower.includes('medium')) return 'Medium';
  if (lower.includes('low')) return 'Low';

  // If nothing matched, return capitalized short form of raw string (preserve other statuses)
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Badge classes for normalized statuses
const statusClasses = {
  Active: 'bg-green-100 text-green-800',
  Upcoming: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-indigo-100 text-indigo-800',
  Low: 'bg-gray-100 text-gray-800',
  // fallback
  Default: 'bg-gray-50 text-gray-700'
};

/** Detect duplicate ids and ensure a stable internal id for each course (do not mutate original persisted id) */
function ensureUniqueInternalIds(arr) {
  const seen = new Map();
  let nextSuffix = 1;
  for (const c of arr) {
    const rawId = c.id ?? c.courseId ?? null;
    if (rawId == null) {
      // if no id at all, assign synthetic one
      c._internalId = `auto-${nextSuffix++}`;
      continue;
    }
    if (!seen.has(rawId)) {
      seen.set(rawId, 1);
      c._internalId = String(rawId);
    } else {
      const count = seen.get(rawId) + 1;
      seen.set(rawId, count);
      // create a non-destructive internal id to avoid collisions in UI lookups
      c._internalId = `${rawId}-${count}`;
      console.warn(`Duplicate course id detected: ${rawId} (assigned internal id ${c._internalId})`);
    }
  }
}

/** Apply filters based on the form inputs */
function applyFilters() {
  showLoading();
  setTimeout(() => {
    currentPage = 1;
    const tf = document.getElementById('titleFilter')?.value.toLowerCase() || '';
    const lf = document.getElementById('levelFilter')?.value || '';
    const df = Array.from(document.querySelectorAll('.duration-filter:checked')).map(c => c.value);
    const tof = document.getElementById('toolFilter')?.value || '';
    const dof = document.getElementById('domainFilter')?.value || '';
    const trf = document.getElementById('trackFilter')?.value || '';
    const sf = document.getElementById('statusFilter')?.value || '';
    filteredCourses = allCourses.filter(c => {
      if (tf && !c.title.toLowerCase().includes(tf)) return false;
      if (lf && c.level !== lf) return false;
      if (df.length) {
        const w = weeksToNum(c.duration);
        let match = false;
        df.forEach(r => {
          if (r === '0-2' && w <= 2) match = true;
          else if (r === '2-5' && w > 2 && w <= 5) match = true;
          else if (r === '5-10' && w > 5 && w <= 10) match = true;
          else if (r === '10+' && w > 10) match = true;
        });
        if (!match) return false;
      }
      if (tof && c.tool !== tof) return false;
      if (dof && c.domain !== dof) return false;
      if (trf && c.track !== trf) return false;
      if (sf && c.status !== sf) return false;
      return true;
    });
    renderCourses();
    updateStats();
    hideLoading();
  }, 100);
}

/** Sort courses according to user selection */
function sortCourses() {
  const sortBy = document.getElementById('sortBy')?.value || 'title';
  const levelOrder = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };
  filteredCourses.sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'level':
        return (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
      case 'duration':
        return weeksToNum(a.duration) - weeksToNum(b.duration);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });
  currentPage = 1;
  renderCourses();
}

/** Toggle between grid and list views */
function toggleView(view) {
  currentView = view;
  const gridBtn = document.getElementById('gridView');
  const listBtn = document.getElementById('listView');
  if (view === 'grid') {
    gridBtn.classList.add('bg-blue-600', 'text-white');
    gridBtn.classList.remove('border', 'border-blue-600');
    listBtn.classList.add('border', 'border-blue-600');
    listBtn.classList.remove('bg-blue-600', 'text-white');
  } else {
    listBtn.classList.add('bg-blue-600', 'text-white');
    listBtn.classList.remove('border', 'border-blue-600');
    gridBtn.classList.add('border', 'border-blue-600');
    gridBtn.classList.remove('bg-blue-600', 'text-white');
  }
  renderCourses();
}

/** Render courses based on filteredCourses and pagination */
function renderCourses() {
  const container = document.getElementById('coursesContainer');
  const countEl = document.getElementById('resultsCount');
  const none = document.getElementById('noResults');
  const paginationEl = document.getElementById('paginationContainer');
  if (!filteredCourses.length) {
    container.innerHTML = '';
    none.classList.remove('hidden');
    countEl.textContent = 'Showing 0 courses';
    paginationEl.classList.add('hidden');
    return;
  }
  none.classList.add('hidden');
  countEl.textContent = `Showing ${filteredCourses.length} course${filteredCourses.length !== 1 ? 's' : ''}`;
  const totalPages = Math.ceil(filteredCourses.length / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const paginated = filteredCourses.slice(startIndex, startIndex + perPage);
  if (currentView === 'grid') {
    // Use 1 column on small screens, 2 on medium, 3 on large, 4 on extra large
    container.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
    container.innerHTML = paginated.map(c => createGridCard(c)).join('');
  } else {
    container.className = 'space-y-4';
    container.innerHTML = paginated.map(c => createListCard(c)).join('');
  }
  // animate cards
  document.querySelectorAll('.course-card').forEach((card, i) => {
    setTimeout(() => card.classList.add('slide-in'), i * 100);
  });
  renderPagination(totalPages);
  paginationEl.classList.toggle('hidden', totalPages <= 1);
}

/** Render pagination controls */
function renderPagination(totalPages) {
  const pagination = document.getElementById('paginationContainer');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  let html = '<div class="flex justify-center space-x-1">';
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  if (currentPage > 1) {
    html += `<button onclick=\"goToPage(${currentPage - 1})\" class=\"px-3 py-1 rounded border\">&laquo;</button>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button onclick=\"goToPage(${i})\" class=\"px-3 py-1 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'border'}\">${i}</button>`;
  }
  if (currentPage < totalPages) {
    html += `<button onclick=\"goToPage(${currentPage + 1})\" class=\"px-3 py-1 rounded border\">&raquo;</button>`;
  }
  html += '</div>';
  pagination.innerHTML = html;
}

/** Navigate to the given page number */
function goToPage(page) {
  const max = Math.ceil(filteredCourses.length / perPage);
  if (page < 1 || page > max) return;
  currentPage = page;
  renderCourses();
}

/** Creates a grid-style course card */
function createGridCard(c) {
  // Dynamically assign a color based on the status emoji
  const statusClass = c.status?.startsWith('🟢')
    ? 'bg-green-100 text-green-800'
    : c.status?.startsWith('🆕')
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-800';
  const levelColor = {
    Beginner: 'bg-blue-100 text-blue-800',
    Intermediate: 'bg-orange-100 text-orange-800',
    Advanced: 'bg-red-100 text-red-800',
    Expert: 'bg-purple-100 text-purple-800'
  };
  return `
    <div class="course-card bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition cursor-pointer" onclick="showCourseDetails('${c.id}')">
      <div class="relative">
        <div class="h-40 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <i class="fas fa-robot text-5xl text-white opacity-50"></i>
        </div>
        <div class="absolute top-2 right-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${c.status || ''}</span>
        </div>
      </div>
      <div class="p-4">
        <h3 class="text-lg font-bold text-gray-800 mb-2 line-clamp-2">${c.title}</h3>
        <div class="flex items-center justify-between mb-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${levelColor[c.level] || 'bg-gray-100'}">${c.level}</span>
          <span class="text-xs text-gray-500"><i class="fas fa-clock mr-1"></i>${c.duration}</span>
        </div>
        <div class="text-xs text-gray-600 mb-2 truncate"><i class="fas fa-tools mr-1"></i>${c.tool || ''}</div>
        <div class="text-xs text-gray-600 mb-3 truncate"><i class="fas fa-tag mr-1"></i>${c.domain || ''}</div>
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            ${starIcons(c.rating)}
            <span class="text-xs text-gray-600 ml-1">${c.rating ?? 'New'}</span>
          </div>
          <span class="text-xs text-gray-500"><i class="fas fa-users mr-1"></i>${Number(c.students).toLocaleString()}</span>
        </div>
        <div class="mt-3 flex gap-1">
          <a href="${c.enrollmentUrl}" class="flex-1 bg-blue-600 text-white text-center text-xs py-1.5 rounded hover:bg-blue-700 transition whitespace-nowrap" onclick="event.stopPropagation()">Enroll</a>
          <a href="${c.mainPageUrl}" class="flex-1 border border-blue-600 text-blue-600 text-center text-xs py-1.5 rounded hover:bg-blue-50 transition whitespace-nowrap" onclick="event.stopPropagation()">Details</a>
        </div>
      </div>
    </div>
  `;
}

/** Creates a list-style course card */
function createListCard(c) {
  // Dynamically assign a color based on the status emoji
  const statusClass = c.status?.startsWith('🟢')
    ? 'bg-green-100 text-green-800'
    : c.status?.startsWith('🆕')
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-800';
  const levelColor = {
    Beginner: 'bg-blue-100 text-blue-800',
    Intermediate: 'bg-orange-100 text-orange-800',
    Advanced: 'bg-red-100 text-red-800',
    Expert: 'bg-purple-100 text-purple-800'
  };
  return `
    <div class="course-card bg-white rounded-lg shadow-md hover:shadow-xl transition overflow-hidden cursor-pointer flex flex-col md:flex-row" onclick="showCourseDetails('${c.id}')">
      <div class="flex-1 p-4">
        <div class="flex justify-between items-start flex-wrap gap-2">
          <h3 class="text-lg font-bold text-gray-800 mb-2 flex-1 min-w-0">${c.title}</h3>
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${c.status || ''}</span>
        </div>
        <div class="flex flex-wrap gap-2 mb-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${levelColor[c.level] || 'bg-gray-100'}">${c.level}</span>
          <span class="text-xs text-gray-500"><i class="fas fa-clock mr-1"></i>${c.duration}</span>
          <span class="text-xs text-gray-600"><i class="fas fa-tag mr-1"></i>${c.domain}</span>
        </div>
        <div class="text-xs text-gray-600 mb-2"><i class="fas fa-tools mr-1"></i>${c.tool}</div>
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            ${starIcons(c.rating)}
            <span class="text-xs text-gray-600 ml-1">${c.rating ?? 'New'}</span>
          </div>
          <span class="text-xs text-gray-500"><i class="fas fa-users mr-1"></i>${Number(c.students).toLocaleString()}</span>
        </div>
      </div>
      <div class="p-4 border-t md:border-t-0 md:border-l flex gap-2 items-center justify-center bg-gray-50">
        <a href="${c.enrollmentUrl}" class="bg-blue-600 text-white px-4 py-2 text-xs rounded hover:bg-blue-700 transition whitespace-nowrap" onclick="event.stopPropagation()">Enroll</a>
        <a href="${c.mainPageUrl}" class="border border-blue-600 text-blue-600 px-4 py-2 text-xs rounded hover:bg-blue-50 transition whitespace-nowrap" onclick="event.stopPropagation()">Details</a>
      </div>
    </div>
  `;
}

/** Generate star icons for rating */
function starIcons(rating) {
  if (!rating) return '<span class="text-gray-400">New</span>';
  const full = Math.floor(rating);
  const hasHalf = (rating % 1) >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    '<i class="fas fa-star text-yellow-500"></i>'.repeat(full) +
    (hasHalf ? '<i class="fas fa-star-half-alt text-yellow-500"></i>' : '') +
    '<i class="far fa-star text-yellow-500"></i>'.repeat(empty)
  );
}

/** Show course details in modal */
function showCourseDetails(id) {
  const c = allCourses.find(x => x.id == id);
  if (!c) return;
  document.getElementById('modalTitle').textContent = c.title;
  document.getElementById('modalContent').innerHTML = `
    <div class="grid grid-cols-2 gap-3 text-sm">\n
      <div class="bg-gray-50 p-3 rounded"><strong>Level:</strong> ${c.level}</div>\n
      <div class="bg-gray-50 p-3 rounded"><strong>Duration:</strong> ${c.duration}</div>\n
      <div class="bg-gray-50 p-3 rounded"><strong>Tool:</strong> ${c.tool}</div>\n
      <div class="bg-gray-50 p-3 rounded"><strong>Status:</strong> ${c.status}</div>\n
    </div>\n
    <div class="bg-gray-50 p-3 rounded mt-3">\n
      <strong>Details:</strong><br/>\n
     Id: <strong>${c.id}</strong> |Domain: <strong>${c.domain}</strong> | Track: <strong>${c.track}</strong>\n
    </div>\n
    <div class="bg-gray-50 p-3 rounded mt-3">\n
      <div class="flex items-center gap-4">\n
        ${starIcons(c.rating)} <span>${c.rating ?? 'New'}/5</span> |\n
        <span>${Number(c.students).toLocaleString()} students</span>\n
      </div>\n
    </div>\n
    <div class="flex gap-3 mt-3">\n
      <a href="${c.enrollmentUrl}" target="_blank" class="flex-1 bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700 transition text-sm">Enroll Now</a>\n
      <a href="${c.mainPageUrl}" target="_blank" class="flex-1 bg-gray-100 text-gray-700 text-center py-2 rounded hover:bg-gray-200 transition text-sm">Course Page</a>\n
    </div>\n
  `;
  document.getElementById('courseModal').classList.remove('hidden');
}

/** Close the modal */
function closeModal() {
  document.getElementById('courseModal').classList.add('hidden');
}

/** Clear all filters */
function clearAllFilters() {
  ['titleFilter','levelFilter','toolFilter','domainFilter','trackFilter','statusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.duration-filter').forEach(cb => cb.checked = false);
  filteredCourses = [...allCourses];
  currentPage = 1;
  renderCourses();
  updateStats();
}

/** Update the statistics boxes */
function updateStats() {
  document.getElementById('totalCourses').textContent = filteredCourses.length;
  // Active courses are those whose status starts with a green indicator (🟢)
  const activeCount = filteredCourses.filter(c => c.status && c.status.startsWith('🟢')).length;
  document.getElementById('activeCourses').textContent = activeCount;
  // Advanced & Expert levels
  document.getElementById('advancedCourses').textContent = filteredCourses.filter(c => ['Advanced','Expert'].includes(c.level)).length;
  // Upcoming courses are those whose status starts with a new indicator (🆕)
  const upcomingCount = filteredCourses.filter(c => c.status && c.status.startsWith('🆕')).length;
  document.getElementById('upcomingCourses').textContent = upcomingCount;
}

/** Show loading spinner and hide content */
function showLoading() {
  document.getElementById('loadingSpinner')?.classList.remove('hidden');
  document.getElementById('coursesContainer')?.classList.add('hidden');
}

/** Hide loading spinner and show content */
function hideLoading() {
  document.getElementById('loadingSpinner')?.classList.add('hidden');
  document.getElementById('coursesContainer')?.classList.remove('hidden');
}

// Close modal when clicking outside the modal content
document.getElementById('courseModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Expose functions globally for inline onclick handlers
window.goToPage = goToPage;
window.showCourseDetails = showCourseDetails;
window.closeModal = closeModal;
window.clearAllFilters = clearAllFilters;

document.addEventListener('DOMContentLoaded', () => {
	// Elements for grouping UI
	const viewAllBtn = document.getElementById('viewAll');
	const viewTracksBtn = document.getElementById('viewTracks');
	const viewDomainsBtn = document.getElementById('viewDomains');
	const viewIndustrialBtn = document.getElementById('viewIndustrial');
	const tracksContainer = document.getElementById('tracksContainer');
	const domainsContainer = document.getElementById('domainsContainer');
	const industrialContainer = document.getElementById('industrialContainer');

	// Load courses (prefer window.coursesData)
	async function loadCourses() {
		let data = window.coursesData;
		const noResultsEl = document.getElementById('noResults');
		if (Array.isArray(data) && data.length) return data;
		try {
			const resp = await fetch('all_courses.json', {cache: 'no-store'});
			if (!resp.ok) throw new Error('Failed to fetch all_courses.json');
			data = await resp.json();
			if (!Array.isArray(data) || data.length === 0) throw new Error('No course data found in JSON');
			return data;
		} catch (err) {
			console.error('Course data load error:', err);
			if (noResultsEl) {
				noResultsEl.classList.remove('hidden');
				noResultsEl.textContent = 'Error loading course data. Check the console for details.';
			}
			return [];
		}
	}

	function normalizeStatus(raw) {
		if (raw === null || raw === undefined) return 'Upcoming';
		const s = String(raw).trim();
		if (s === '') return 'Upcoming';
		const lower = s.toLowerCase();
		if (s.startsWith('🟢') || lower.includes('active') || lower.includes('existing') || lower.includes('high')) return 'Active';
		if (s.startsWith('🆕') || s.startsWith('🟡') || lower.includes('upcoming') || lower.includes('new') || lower.includes('coming')) return 'Upcoming';
		if (lower.includes('medium')) return 'Medium';
		if (lower.includes('low')) return 'Low';
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function ensureUniqueInternalIds(arr) {
		const seen = new Map();
		let nextSuffix = 1;
		for (const c of arr) {
			const rawId = c.id ?? c.courseId ?? null;
			if (rawId == null) {
				c._internalId = `auto-${nextSuffix++}`;
				continue;
			}
			if (!seen.has(rawId)) {
				seen.set(rawId, 1);
				c._internalId = String(rawId);
			} else {
				const count = seen.get(rawId) + 1;
				seen.set(rawId, count);
				c._internalId = `${rawId}-${count}`;
				console.warn(`Duplicate course id detected: ${rawId} (assigned internal id ${c._internalId})`);
			}
		}
	}

	// Build group indexes: tracks -> [courses], domains -> [courses], categories -> [courses]
	function buildIndexes(courses) {
		const tracks = new Map();
		const domains = new Map();
		const categories = new Map();

		for (const c of courses) {
			const track = c.track || 'Untracked';
			const domain = c.domain || 'Undomain';
			const category = c.category || 'Academic';

			if (!tracks.has(track)) tracks.set(track, []);
			tracks.get(track).push(c);

			if (!domains.has(domain)) domains.set(domain, []);
			domains.get(domain).push(c);

			if (!categories.has(category)) categories.set(category, []);
			categories.get(category).push(c);
		}
		return { tracks, domains, categories };
	}

	// Renders a compact list of tracks (with counts). Clicking expands to show that track's courses inline.
	function renderTracksIndex(tracksMap) {
		tracksContainer.innerHTML = '';
		for (const [track, arr] of tracksMap.entries()) {
			const card = document.createElement('div');
			card.className = 'bg-white p-4 rounded shadow mb-3';
			card.innerHTML = `
				<div class="flex justify-between items-center">
					<div class="font-semibold">${track}</div>
					<div class="text-sm text-gray-600">${arr.length} course(s)</div>
				</div>
				<div class="mt-3 hidden track-courses" data-track="${track}"></div>
			`;
			card.addEventListener('click', (ev) => {
				// toggle expansion (prevent from toggling when clicking a button inside)
				if (ev.target.tagName.toLowerCase() === 'button') return;
				const inner = card.querySelector('.track-courses');
				if (inner.classList.contains('hidden')) {
					inner.classList.remove('hidden');
					inner.innerHTML = ''; // populate courses here
					arr.forEach(c => {
						const li = document.createElement('div');
						li.className = 'p-2 border rounded mb-2 flex justify-between items-center';
						li.innerHTML = `<div><strong>${c.title}</strong><div class="text-xs text-gray-600">${c.domain} • ${c.tool}</div></div><div><span class="text-sm text-gray-700">${c.normalizedStatus}</span></div>`;
						li.addEventListener('click', (e)=> { e.stopPropagation(); openModal(c); });
						inner.appendChild(li);
					});
				} else {
					inner.classList.add('hidden');
				}
			});
			tracksContainer.appendChild(card);
		}
	}

	// Render domain index similarly
	function renderDomainsIndex(domainsMap) {
		domainsContainer.innerHTML = '';
		for (const [domain, arr] of domainsMap.entries()) {
			const card = document.createElement('div');
			card.className = 'bg-white p-4 rounded shadow mb-3';
			card.innerHTML = `
				<div class="flex justify-between items-center">
					<div class="font-semibold">${domain}</div>
					<div class="text-sm text-gray-600">${arr.length} course(s)</div>
				</div>
				<div class="mt-3 hidden domain-courses" data-domain="${domain}"></div>
			`;
			card.addEventListener('click', (ev) => {
				const inner = card.querySelector('.domain-courses');
				if (inner.classList.contains('hidden')) {
					inner.classList.remove('hidden');
					inner.innerHTML = '';
					arr.forEach(c => {
						const li = document.createElement('div');
						li.className = 'p-2 border rounded mb-2 flex justify-between items-center';
						li.innerHTML = `<div><strong>${c.title}</strong><div class="text-xs text-gray-600">${c.track} • ${c.tool}</div></div><div><span class="text-sm text-gray-700">${c.normalizedStatus}</span></div>`;
						li.addEventListener('click', (e)=> { e.stopPropagation(); openModal(c); });
						inner.appendChild(li);
					});
				} else {
					inner.classList.add('hidden');
				}
			});
			domainsContainer.appendChild(card);
		}
	}

	// Render Industrial category grouped by track
	function renderIndustrial(categoriesMap) {
		industrialContainer.innerHTML = '';
		const industrialArr = categoriesMap.get('Industrial') || [];
		if (industrialArr.length === 0) {
			industrialContainer.innerHTML = '<div class="text-gray-600">No industrial courses available.</div>';
			return;
		}
		// group industrial by track
		const byTrack = new Map();
		for (const c of industrialArr) {
			const t = c.track || 'Untracked';
			if (!byTrack.has(t)) byTrack.set(t, []);
			byTrack.get(t).push(c);
		}
		for (const [track, arr] of byTrack.entries()) {
			const div = document.createElement('div');
			div.className = 'bg-white p-4 rounded shadow mb-3';
			div.innerHTML = `<div class="font-semibold">${track} — ${arr.length} item(s)</div><div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"></div>`;
			const grid = div.querySelector('div.mt-3');
			arr.forEach(c => {
				const card = document.createElement('div');
				card.className = 'p-3 border rounded cursor-pointer';
				card.innerHTML = `<strong>${c.title}</strong><div class="text-xs text-gray-600">${c.domain} • ${c.tool}</div>`;
				card.addEventListener('click', ()=> openModal(c));
				grid.appendChild(card);
			});
			industrialContainer.appendChild(div);
		}
	}

	// Hook up grouping UI
	function showOnly(containerToShow) {
		// hide all group containers and main courses
		[tracksContainer, domainsContainer, industrialContainer, coursesContainer].forEach(el => {
			if (!el) return;
			el.classList.add('hidden');
		});
		// show requested (if containerToShow is 'all' show coursesContainer)
		if (containerToShow === 'all') {
			coursesContainer.classList.remove('hidden');
		} else if (containerToShow === 'tracks') {
			tracksContainer.classList.remove('hidden');
		} else if (containerToShow === 'domains') {
			domainsContainer.classList.remove('hidden');
		} else if (containerToShow === 'industrial') {
			industrialContainer.classList.remove('hidden');
		}
	}

	// After data is loaded, create indexes and wire buttons
	(async function main() {
		let courses = await loadCourses();
		if (!courses || courses.length === 0) return;

		// normalize & internal IDs
		for (const c of courses) c.normalizedStatus = normalizeStatus(c.status ?? c.state ?? '');
		ensureUniqueInternalIds(courses);

		const { tracks, domains, categories } = buildIndexes(courses);

		// populate filters (reuse earlier populateFilters logic but include categories)
		function populateFilters() {
			const tools = Array.from(new Set(courses.map(c => c.tool).filter(Boolean))).sort();
			const doms = Array.from(new Set(courses.map(c => c.domain).filter(Boolean))).sort();
			const trks = Array.from(new Set(courses.map(c => c.track).filter(Boolean))).sort();
			const statuses = Array.from(new Set(courses.map(c => c.normalizedStatus).filter(Boolean))).sort();
			// toolFilter, domainFilter, trackFilter and statusFilter elements exist in page
			if (toolFilter) toolFilter.innerHTML = '<option value="">All Tools</option>' + tools.map(v => `<option value="${v}">${v}</option>`).join('');
			if (domainFilter) domainFilter.innerHTML = '<option value="">All Domains</option>' + doms.map(v => `<option value="${v}">${v}</option>`).join('');
			if (trackFilter) trackFilter.innerHTML = '<option value="">All Tracks</option>' + trks.map(v => `<option value="${v}">${v}</option>`).join('');
			if (statusFilter) statusFilter.innerHTML = '<option value="">All Statuses</option>' + statuses.map(v => `<option value="${v}">${v}</option>`).join('');
		}
		populateFilters();

		// initial render of grouped indexes
		renderTracksIndex(tracks);
		renderDomainsIndex(domains);
		renderIndustrial(categories);

		// wire view buttons
		viewAllBtn && viewAllBtn.addEventListener('click', ()=> { showOnly('all'); renderCourses(); });
		viewTracksBtn && viewTracksBtn.addEventListener('click', ()=> { showOnly('tracks'); });
		viewDomainsBtn && viewDomainsBtn.addEventListener('click', ()=> { showOnly('domains'); });
		viewIndustrialBtn && viewIndustrialBtn.addEventListener('click', ()=> { showOnly('industrial'); });

		// ensure default is All
		showOnly('all');

		// reuse existing event bindings and rendering functions (applyFiltersAndSort, renderCourses, updateStats etc.)
		// ...existing code connecting filters, sort, pagination, modal, renderCourses...
		// Note: The rest of the app's renderCourses/applyFiltersAndSort/updateStats functions should use `courses` variable in this scope.
	})();
});