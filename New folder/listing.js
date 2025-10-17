const DATA_URL = "./all_courses.json";
// Grouped data by track and domain for faster lookups on listing pages. When a
// specific track or domain is requested via URL parameters, we load
// `courses_grouped.json` and extract only the needed subset. This avoids
// processing the entire dataset on the client, which can cause timeouts.
const GROUPED_URL = "./courses_grouped.json";
let allCourses = [];
let filteredCourses = [];
let currentPage = 1;
const perPage = 12;
let currentView = "grid";
// Pre-filter key and value determine whether the listing is for a specific track or domain
let preFilterKey = null;
let preFilterValue = null;

/**
 * Normalize a string for comparison. This helper converts curly quotes to straight
 * quotes and lowercases the value to avoid case-sensitive mismatches. It also
 * trims whitespace. If the input is falsy it returns an empty string. This
 * normalization is useful for ensuring that query parameters match the track
 * and domain names exactly even when URL encoding or curly quotes are involved.
 *
 * @param {string} value The value to normalize
 * @returns {string} The normalized string
 */
function normalizeValue(value) {
  if (!value) return '';
  return value
    .replace(/[\u2018\u2019]/g, "'") // replace curly single quotes with straight single quotes
    .replace(/[\u201C\u201D]/g, '"') // replace curly double quotes with straight double quotes
    .toLowerCase()
    .trim();
}

// Global variables for tracking current view state
let currentGroup = null;
let currentGroupType = null;

// Use the window load event instead of DOMContentLoaded to ensure that
// the large all_courses.js script has fully executed before we access
// window.allCoursesData. When using file:// protocol the script may take
// longer to load, so waiting for the full page load avoids race conditions.
window.addEventListener('load', () => initListing());

async function initListing() {
  // Determine whether this listing is filtered by track or domain based on query params
  const params = new URLSearchParams(window.location.search);
  // Accept both `mode` & `value`, or `track` or `domain` directly. Decode and normalize values.
  const modeParamRaw = params.get('mode');
  const valueParamRaw = params.get('value');
  const trackParamRaw = params.get('track');
  const domainParamRaw = params.get('domain');
  if (modeParamRaw && valueParamRaw) {
    preFilterKey = decodeURIComponent(modeParamRaw);
    preFilterValue = decodeURIComponent(valueParamRaw);
  } else if (trackParamRaw) {
    preFilterKey = 'track';
    preFilterValue = decodeURIComponent(trackParamRaw);
  } else if (domainParamRaw) {
    preFilterKey = 'domain';
    preFilterValue = decodeURIComponent(domainParamRaw);
  }

  // Load course data. If a track or domain is specified via the query
  // parameters, load only the relevant group from courses_grouped.json to
  // improve performance and reliability. Otherwise load the full list.
  if (preFilterKey && preFilterValue) {
    try {
      const res = await fetch(GROUPED_URL);
      const grouped = await res.json();
      // Determine which section to use based on the key
      const section = preFilterKey === 'track' ? 'tracks' : 'domains';
      // Find a matching key using normalized comparison because JSON keys may
      // have different casing or quotes. Iterate through all keys to find the
      // first match.
      const normalizedTarget = normalizeValue(preFilterValue);
      let match = null;
      for (const key of Object.keys(grouped[section] || {})) {
        if (normalizeValue(key) === normalizedTarget) {
          match = key;
          break;
        }
      }
      if (match) {
        filteredCourses = grouped[section][match] || [];
      } else {
        filteredCourses = [];
      }
      // All courses are just the filtered subset when in a listing view.
      allCourses = [...filteredCourses];
    } catch (error) {
      console.error('Failed to load grouped courses:', error);
      // Fallback: if grouped data fails, fall back to full dataset
    }
  }
  // If filteredCourses is still empty (either because no pre-filter or fetch
  // failed), load the full dataset from all_courses.json or window.allCoursesData
  if (filteredCourses.length === 0) {
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
          console.error('Failed to load courses:', error);
          return;
        }
      }
    }
    // When using the full dataset and a preFilter is provided, apply the filter here.
    if (preFilterKey && preFilterValue) {
      const normalizedValue = normalizeValue(preFilterValue);
      filteredCourses = allCourses.filter(c => normalizeValue(c[preFilterKey]) === normalizedValue);
    } else {
      filteredCourses = [...allCourses];
    }
  }

  // Update the hero heading and metadata if this is a filtered page
  if (preFilterKey && preFilterValue) {
    const headingEl = document.getElementById('listingHeading');
    if (headingEl) {
      const label = preFilterKey.charAt(0).toUpperCase() + preFilterKey.slice(1);
      headingEl.textContent = `${label}: ${preFilterValue}`;
    }
    // Update the page title and meta description for better SEO & sharing
    const pageType = preFilterKey === 'track' ? 'Track' : 'Domain';
    document.title = `${preFilterValue} ${pageType} Courses | AI Courses Hub`;
    const description = `Explore ${filteredCourses.length} ${preFilterValue} ${pageType.toLowerCase()} courses on AI Courses Hub. Learn programming, machine learning, data science and more.`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${preFilterValue} ${pageType} Courses | AI Courses Hub`);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }

  // Inject structured data for the filtered set
  injectStructuredData();
  populateFilters();
  setupEventListeners();
  // If a pre-filter is active, pre-select and hide the appropriate filter control
  if (preFilterKey && preFilterValue) {
    const selectEl = document.getElementById(preFilterKey + 'Filter');
    if (selectEl) {
      selectEl.value = preFilterValue;
      // Hide the select from the UI to avoid confusing the user
      selectEl.classList.add('hidden');
    }
  }
  renderCourses();
  // Ensure loading spinner is hidden after initial render
  hideLoading();
  updateStats();
}

/** Injects schema.org structured data into the page for SEO */
function injectStructuredData() {
  if (!filteredCourses.length) return;
  const courses = filteredCourses.map(c => ({
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
    "url": window.location.href,
    "description": "Global platform for advanced AI and Quantum Computing courses.",
    "hasCourse": courses
  });
  document.head.appendChild(script);
}

/** Populate dynamic select options for tool, domain, track, and status filters */
function populateFilters() {
  const tools = [...new Set(allCourses.map(c => c.tool).filter(Boolean))];
  const domains = [...new Set(allCourses.map(c => c.domain).filter(Boolean))];
  const statuses = [...new Set(allCourses.map(c => c.status).filter(Boolean))];
  
  // Sort and populate tools
  tools.sort();
  populateSelect('toolFilter', tools);
  
  // Sort and populate domains
  domains.sort();
  populateSelect('domainFilter', domains);
  
  // Group tracks into industry and regular
  const trackSelect = document.getElementById('trackFilter');
  if (trackSelect) {
    // Clear existing options except the first one
    while (trackSelect.options.length > 1) {
      trackSelect.remove(1);
    }
    
    // Get all unique tracks
    const allTracks = [...new Set(allCourses.map(c => c.track).filter(Boolean))];
    
    // Industry tracks list
    const industryTracks = [
      'Industry AI Leadership & Strategy',
      'Government & Public AI',
      'No-Code AI & Citizen Innovation',
      'AI Research & Scientific Discovery',
      'Industry AI & Intelligent Manufacturing',
      'AI for Sustainability & Climate Resilience',
      'AI for Global Health, Biomedicine & Life Sciences',
      'AI for Advanced Materials & Nanotech',
      'AI for Energy, Environment & Sustainability',
      'AI for Space, Geospatial & Planetary Science',
      'AI for Quantum & Cybersecurity',
      'AI for Robotics & Intelligent Systems',
      'AI for Biomedical Engineering',
      'AI for Climate & Sustainability',
      'AI for Policy & Global Security',
      'AI for Quantum Computing & Emerging Tech',
      'Quantum AI & Software Engineering',
      'Quantum AI Deployment & Integration',
      'Quantum AI & Industry Applications'
    ];
    
    // Create industry tracks optgroup
    const industryTracksGroup = document.createElement('optgroup');
    industryTracksGroup.label = 'Industry Tracks';
    industryTracks.forEach(track => {
      if (allTracks.includes(track)) {
        const opt = document.createElement('option');
        opt.value = track;
        opt.textContent = track;
        industryTracksGroup.appendChild(opt);
      }
    });
    if (industryTracksGroup.options.length > 0) {
      trackSelect.appendChild(industryTracksGroup);
    }
    
    // Create regular tracks optgroup
    const regularTracks = allTracks.filter(track => !industryTracks.includes(track));
    if (regularTracks.length > 0) {
      const regularTracksGroup = document.createElement('optgroup');
      regularTracksGroup.label = 'Regular Tracks';
      regularTracks.sort().forEach(track => {
        const opt = document.createElement('option');
        opt.value = track;
        opt.textContent = track;
        regularTracksGroup.appendChild(opt);
      });
      trackSelect.appendChild(regularTracksGroup);
    }
  }

  // Sort and populate statuses
  statuses.sort();
  populateSelect('statusFilter', statuses);
}

function populateSelect(id, opts) {
  const sel = document.getElementById(id);
  // If the select does not exist in the template, skip
  if (!sel) return;
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

/** Setup UI event listeners */
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
  document.getElementById('toolFilter')?.addEventListener('change', applyFilters);
  document.getElementById('domainFilter')?.addEventListener('change', applyFilters);
  document.getElementById('trackFilter')?.addEventListener('change', applyFilters);
}

/** Debounce helper */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** Convert a duration like "6 Weeks" to a numeric value */
function weeksToNum(duration) {
  const match = (duration || '').match(/(\d+)/);
  return match ? parseInt(match[0], 10) : 0;
}

/** Apply all filters including pre-filter */
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
      // Pre-filter condition: if a track/domain is enforced, ensure match
      if (preFilterKey && preFilterValue && c[preFilterKey] !== preFilterValue) return false;
      if (tf && !c.title.toLowerCase().includes(tf)) return false;
      if (lf && c.level !== lf) return false;
      // Duration filter
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

/** Sort courses */
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

/** Render courses with pagination */
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
  document.querySelectorAll('.course-card').forEach((card, i) => {
    setTimeout(() => card.classList.add('slide-in'), i * 100);
  });
  renderPagination(totalPages);
  paginationEl.classList.toggle('hidden', totalPages <= 1);

  // Update statistics whenever courses are rendered
  updateStats();
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
  if (currentPage > 1) html += `<button onclick=\"goToPage(${currentPage - 1})\" class=\"px-3 py-1 rounded border\">&laquo;</button>`;
  for (let i = start; i <= end; i++) {
    html += `<button onclick=\"goToPage(${i})\" class=\"px-3 py-1 rounded ${i === currentPage ? 'bg-blue-600 text-white' : 'border'}\">${i}</button>`;
  }
  if (currentPage < totalPages) html += `<button onclick=\"goToPage(${currentPage + 1})\" class=\"px-3 py-1 rounded border\">&raquo;</button>`;
  html += '</div>';
  pagination.innerHTML = html;
}

/** Navigate to a page */
function goToPage(page) {
  const max = Math.ceil(filteredCourses.length / perPage);
  if (page < 1 || page > max) return;
  currentPage = page;
  renderCourses();
}

/** Create a grid-style course card */
function createGridCard(c) {
  // Industry tracks list for checking
  const industryTracks = [
    'Industry AI Leadership & Strategy',
    'Government & Public AI',
    'No-Code AI & Citizen Innovation',
    'AI Research & Scientific Discovery',
    'Industry AI & Intelligent Manufacturing',
    'AI for Sustainability & Climate Resilience',
    'AI for Global Health, Biomedicine & Life Sciences',
    'AI for Advanced Materials & Nanotech',
    'AI for Energy, Environment & Sustainability',
    'AI for Space, Geospatial & Planetary Science',
    'AI for Quantum & Cybersecurity',
    'AI for Robotics & Intelligent Systems',
    'AI for Biomedical Engineering',
    'AI for Climate & Sustainability',
    'AI for Policy & Global Security',
    'AI for Quantum Computing & Emerging Tech',
    'Quantum AI & Software Engineering',
    'Quantum AI Deployment & Integration',
    'Quantum AI & Industry Applications'
  ];

  const isIndustryTrack = industryTracks.includes(c.track);
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
    <div class="course-card bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition cursor-pointer ${isIndustryTrack ? 'border-2 border-purple-400' : ''}" onclick="showCourseDetails('${c.id}')">
      <div class="relative">
        <div class="h-40 bg-gradient-to-br ${isIndustryTrack ? 'from-purple-500 to-indigo-600' : 'from-blue-500 to-purple-600'} flex items-center justify-center">
          <i class="fas ${isIndustryTrack ? 'fa-industry' : 'fa-robot'} text-5xl text-white opacity-50"></i>
        </div>
        <div class="absolute top-2 right-2 flex gap-2">
          ${isIndustryTrack ? `
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
            <i class="fas fa-industry mr-1"></i>Industry
          </span>
          ` : ''}
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
        <div class="text-xs text-gray-600 mb-2 truncate"><i class="fas fa-tag mr-1"></i>${c.domain || ''}</div>
        <div class="text-xs text-gray-600 mb-3 truncate"><i class="fas fa-stream mr-1"></i>${c.track || ''}</div>
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

/** Create a list-style course card */
function createListCard(c) {
  // Industry tracks list for checking
  const industryTracks = [
    'Industry AI Leadership & Strategy',
    'Government & Public AI',
    'No-Code AI & Citizen Innovation',
    'AI Research & Scientific Discovery',
    'Industry AI & Intelligent Manufacturing',
    'AI for Sustainability & Climate Resilience',
    'AI for Global Health, Biomedicine & Life Sciences',
    'AI for Advanced Materials & Nanotech',
    'AI for Energy, Environment & Sustainability',
    'AI for Space, Geospatial & Planetary Science',
    'AI for Quantum & Cybersecurity',
    'AI for Robotics & Intelligent Systems',
    'AI for Biomedical Engineering',
    'AI for Climate & Sustainability',
    'AI for Policy & Global Security',
    'AI for Quantum Computing & Emerging Tech',
    'Quantum AI & Software Engineering',
    'Quantum AI Deployment & Integration',
    'Quantum AI & Industry Applications'
  ];

  const isIndustryTrack = industryTracks.includes(c.track);
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
    <div class="course-card bg-white rounded-lg shadow-md hover:shadow-xl transition overflow-hidden cursor-pointer flex flex-col md:flex-row ${isIndustryTrack ? 'border-2 border-purple-400' : ''}" onclick="showCourseDetails('${c.id}')">
      <div class="flex-1 p-4">
        <div class="flex justify-between items-start flex-wrap gap-2">
          <h3 class="text-lg font-bold text-gray-800 mb-2 flex-1 min-w-0">${c.title}</h3>
          <div class="flex gap-2">
            ${isIndustryTrack ? `
            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              <i class="fas fa-industry mr-1"></i>Industry
            </span>
            ` : ''}
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${c.status || ''}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mb-2">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${levelColor[c.level] || 'bg-gray-100'}">${c.level}</span>
          <span class="text-xs text-gray-500"><i class="fas fa-clock mr-1"></i>${c.duration}</span>
          <span class="text-xs text-gray-600"><i class="fas fa-tag mr-1"></i>${c.domain}</span>
        </div>
        <div class="text-xs text-gray-600 mb-2"><i class="fas fa-tools mr-1"></i>${c.tool}</div>
        <div class="text-xs text-gray-600 mb-2"><i class="fas fa-stream mr-1"></i>${c.track}</div>
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            ${starIcons(c.rating)}
            <span class="text-xs text-gray-600 ml-1">${c.rating ?? 'New'}</span>
          </div>
          <span class="text-xs text-gray-500"><i class="fas fa-users mr-1"></i>${Number(c.students).toLocaleString()}</span>
        </div>
      </div>
      <div class="p-4 border-t md:border-t-0 md:border-l flex gap-2 items-center justify-center ${isIndustryTrack ? 'bg-purple-50' : 'bg-gray-50'}">
        <a href="${c.enrollmentUrl}" class="bg-blue-600 text-white px-4 py-2 text-xs rounded hover:bg-blue-700 transition whitespace-nowrap" onclick="event.stopPropagation()">Enroll</a>
        <a href="${c.mainPageUrl}" class="border border-blue-600 text-blue-600 px-4 py-2 text-xs rounded hover:bg-blue-50 transition whitespace-nowrap" onclick="event.stopPropagation()">Details</a>
      </div>
    </div>
  `;
}

/** Show course details in a modal */
function showCourseDetails(id) {
  const c = allCourses.find(x => x.id == id);
  if (!c) return;
  document.getElementById('modalTitle').textContent = c.title;
  document.getElementById('modalContent').innerHTML = `
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="bg-gray-50 p-3 rounded"><strong>Level:</strong> ${c.level}</div>
      <div class="bg-gray-50 p-3 rounded"><strong>Duration:</strong> ${c.duration}</div>
      <div class="bg-gray-50 p-3 rounded"><strong>Tool:</strong> ${c.tool}</div>
      <div class="bg-gray-50 p-3 rounded"><strong>Status:</strong> ${c.status}</div>
    </div>
    <div class="bg-gray-50 p-3 rounded mt-3">
      <strong>Details:</strong><br/>
      Domain: <strong>${c.domain}</strong> | Track: <strong>${c.track}</strong>
    </div>
    <div class="bg-gray-50 p-3 rounded mt-3">
      <div class="flex items-center gap-4">
        ${starIcons(c.rating)} <span>${c.rating ?? 'New'}/5</span> |
        <span>${Number(c.students).toLocaleString()} students</span>
      </div>
    </div>
    <div class="flex gap-3 mt-3">
      <a href="${c.enrollmentUrl}" target="_blank" class="flex-1 bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700 transition text-sm">Enroll Now</a>
      <a href="${c.mainPageUrl}" target="_blank" class="flex-1 bg-gray-100 text-gray-700 text-center py-2 rounded hover:bg-gray-200 transition text-sm">Course Page</a>
    </div>
    <div class="mt-4" id="pricingTable"></div>
  `;
  // Show pricing table
  if (c.pricing) {
    const pricingTable = `
      <table class="w-full text-sm mb-2">
        <thead>
          <tr class="bg-gray-100">
            <th class="p-2 text-left">Mode</th>
            <th class="p-2 text-right">USD</th>
            <th class="p-2 text-right">INR</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="p-2">LMS Only (${c.pricing.weeks} week${c.pricing.weeks > 1 ? 's' : ''})</td>
            <td class="p-2 text-right">$${c.pricing.lms.usd}</td>
            <td class="p-2 text-right">₹${c.pricing.lms.inr}</td>
          </tr>
          <tr>
            <td class="p-2">LMS + Video</td>
            <td class="p-2 text-right">$${c.pricing.lms_video.usd}</td>
            <td class="p-2 text-right">₹${c.pricing.lms_video.inr}</td>
          </tr>
          <tr>
            <td class="p-2">LMS + Video + Live</td>
            <td class="p-2 text-right">$${c.pricing.lms_video_live.usd}</td>
            <td class="p-2 text-right">₹${c.pricing.lms_video_live.inr}</td>
          </tr>
        </tbody>
      </table>
    `;
    document.getElementById('pricingTable').innerHTML = pricingTable;
    document.getElementById('pricingWeeks').value = c.pricing.weeks;
    document.getElementById('pricingMode').value = 'lms';
    updatePricingCalculator(c);
    document.getElementById('pricingMode').onchange = () => updatePricingCalculator(c);
    document.getElementById('pricingWeeks').oninput = () => updatePricingCalculator(c);
  } else {
    document.getElementById('pricingTable').innerHTML = '<div class="text-gray-500">No pricing info available.</div>';
  }
  document.getElementById('courseModal').classList.remove('hidden');
}

/** Close the modal */
function closeModal() {
  document.getElementById('courseModal').classList.add('hidden');
}

/** Clear all filters while preserving the pre-filter */
function clearAllFilters() {
  ['titleFilter','levelFilter','toolFilter','domainFilter','trackFilter','statusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('.duration-filter').forEach(cb => cb.checked = false);
  // Reapply pre-filter
  if (preFilterKey && preFilterValue) {
    filteredCourses = allCourses.filter(c => c[preFilterKey] === preFilterValue);
    const selectEl = document.getElementById(preFilterKey + 'Filter');
    if (selectEl) {
      selectEl.value = preFilterValue;
    }
  } else {
    filteredCourses = [...allCourses];
  }
  currentPage = 1;
  renderCourses();
  updateStats();
}

/** Update the statistics boxes */
function updateStats() {
  document.getElementById('totalCourses').textContent = filteredCourses.length;
  const activeCount = filteredCourses.filter(c => c.status && c.status.startsWith('🟢')).length;
  document.getElementById('activeCourses').textContent = activeCount;
  document.getElementById('advancedCourses').textContent = filteredCourses.filter(c => ['Advanced','Expert'].includes(c.level)).length;
  const upcomingCount = filteredCourses.filter(c => c.status && c.status.startsWith('🆕')).length;
  document.getElementById('upcomingCourses').textContent = upcomingCount;
}

/** Show loading spinner */
function showLoading() {
  document.getElementById('loadingSpinner')?.classList.remove('hidden');
  document.getElementById('coursesContainer')?.classList.add('hidden');
}

/** Hide loading spinner */
function hideLoading() {
  document.getElementById('loadingSpinner')?.classList.add('hidden');
  document.getElementById('coursesContainer')?.classList.remove('hidden');
}

// Close modal on outside click
document.getElementById('courseModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Expose functions globally for inline onclick handlers
window.goToPage = goToPage;
window.showCourseDetails = showCourseDetails;
window.closeModal = closeModal;
window.clearAllFilters = clearAllFilters;

function updatePricingCalculator(course) {
  const mode = document.getElementById('pricingMode').value;
  let weeks = parseInt(document.getElementById('pricingWeeks').value, 10) || 1;
  if (weeks < 1) weeks = 1;
  // Pricing logic
  let usd = 0, inr = 0;
  if (mode === 'lms') {
    usd = weeks * 19;
    inr = weeks * 1499;
  } else if (mode === 'lms_video') {
    usd = weeks * 19 + 60;
    inr = weeks * 1499 + 6000;
  } else if (mode === 'lms_video_live') {
    if (weeks === 1) {
      usd = 19 + 60 + 60;
      inr = 1499 + 6000 + 5000;
    } else if (weeks === 2) {
      usd = 2 * 19 + 60 + 2 * 60;
      inr = 2 * 1499 + 6000 + 2 * 5000;
    } else {
      usd = weeks * 19 + 60 + 2 * 60 + (weeks - 2) * 60;
      inr = weeks * 1499 + 6000 + 2 * 5000 + (weeks - 2) * 5000;
    }
  }
  document.getElementById('calcUsd').textContent = `$${usd}`;
  document.getElementById('calcInr').textContent = `₹${inr}`;
}