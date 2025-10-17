// Configuration
const CONFIG = {
  DATA_URL: '/api/courses',
  GROUPED_URL: '/api/courses/grouped',
  ITEMS_PER_PAGE: 12,
  ANIMATION_DURATION: 300,
  DEFAULT_SORT: 'popular'
};

// State management
const state = {
  allCourses: [],
  filteredCourses: [],
  currentPage: 1,
  currentView: 'grid',
  filters: {
    search: '',
    track: '',
    domain: '',
    level: '',
    duration: '',
    sortBy: CONFIG.DEFAULT_SORT
  },
  loading: false,
  preFilterKey: null,
  preFilterValue: null
};

// Cache DOM elements
const elements = {
  coursesGrid: document.getElementById('coursesGrid'),
  searchInput: document.getElementById('searchInput'),
  trackFilter: document.getElementById('trackFilter'),
  levelFilter: document.getElementById('levelFilter'),
  domainFilter: document.getElementById('domainFilter'),
  durationFilter: document.getElementById('durationFilter'),
  sortBy: document.getElementById('sortBy'),
  loadingState: document.getElementById('loadingState'),
  noResults: document.getElementById('noResults'),
  resultsCount: document.getElementById('resultsCount'),
  pagination: document.getElementById('pagination'),
  viewToggles: document.querySelectorAll('.view-toggle'),
  filterToggle: document.getElementById('filterToggle'),
  advancedFilters: document.getElementById('advancedFilters'),
  totalCourses: document.getElementById('totalCourses'),
  activeCourses: document.getElementById('activeCourses'),
  advancedCourses: document.getElementById('advancedCourses'),
  listingHeading: document.getElementById('listingHeading')
};

// Utility functions
const utils = {
  debounce: (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },
  
  normalizeString: (str) => {
    if (!str) return '';
    return str.toLowerCase().trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');
  },
  
  formatPrice: (price) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  },
  
  showToast: (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    } animate-slide-in`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
};

// Course rendering
const renderer = {
  createCourseCard: (course) => {
    const card = document.createElement('div');
    card.className = 'course-card bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300';
    
    // Get the lowest price from available options
    const lowestPrice = course.pricing ? Math.min(
      course.pricing.lms?.inr || Infinity,
      course.pricing.lms_video?.inr || Infinity,
      course.pricing.lms_video_live?.inr || Infinity
    ) : null;
    
    const levelClass = {
      'Beginner': 'bg-green-100 text-green-800',
      'Intermediate': 'bg-yellow-100 text-yellow-800',
      'Advanced': 'bg-red-100 text-red-800',
      'Expert': 'bg-purple-100 text-purple-800'
    }[course.level] || 'bg-gray-100 text-gray-800';

    card.innerHTML = `
      <div class="relative">
        <div class="aspect-video bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <i class="fas fa-graduation-cap text-5xl text-white opacity-50"></i>
        </div>
        <div class="absolute top-2 right-2">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${levelClass}">
            ${course.level}
          </span>
        </div>
      </div>
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-2 line-clamp-2">${course.title}</h3>
        <p class="text-gray-600 text-sm mb-4 line-clamp-2">${course.description}</p>
        
        <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div class="flex items-center">
            <i class="far fa-clock mr-1"></i>
            ${course.duration}
          </div>
          <div class="flex items-center">
            <i class="far fa-user mr-1"></i>
            ${course.students.toLocaleString()}
          </div>
        </div>

        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <div class="flex text-yellow-400">
              ${Array(Math.floor(course.rating)).fill('★').join('')}
              ${course.rating % 1 > 0 ? '½' : ''}
              ${Array(5 - Math.ceil(course.rating)).fill('☆').join('')}
            </div>
            <span class="ml-1 text-sm text-gray-600">(${course.rating.toFixed(1)})</span>
          </div>
          <div class="text-blue-600 font-semibold">
            ${lowestPrice ? utils.formatPrice(lowestPrice) : 'N/A'}
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          ${course.tool.split(',').map(tool => `
            <span class="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
              ${tool.trim()}
            </span>
          `).join('')}
        </div>

        <a href="${course.enrollmentUrl}" target="_blank" 
           class="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition duration-300">
          Enroll Now
        </a>
      </div>
    `;
    
    return card;
  },
  
  renderCourses: () => {
    const fragment = document.createDocumentFragment();
    const startIndex = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
    const coursesToShow = state.filteredCourses.slice(startIndex, endIndex);
    
    elements.coursesGrid.innerHTML = '';
    elements.loadingState.classList.remove('hidden');
    
    setTimeout(() => {
      coursesToShow.forEach(course => {
        fragment.appendChild(renderer.createCourseCard(course));
      });
      
      elements.coursesGrid.innerHTML = '';
      elements.coursesGrid.appendChild(fragment);
      elements.loadingState.classList.add('hidden');
      
      // Update results count and visibility
      elements.resultsCount.textContent = state.filteredCourses.length;
      elements.noResults.style.display = 
        state.filteredCourses.length === 0 ? 'block' : 'none';
    }, 300); // Small delay for loading animation
  },
  
  renderPagination: () => {
    const totalPages = Math.ceil(state.filteredCourses.length / CONFIG.ITEMS_PER_PAGE);
    const fragment = document.createDocumentFragment();
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = `px-3 py-1 rounded ${
      state.currentPage === 1 
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
        : 'bg-white hover:bg-gray-50'
    }`;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = state.currentPage === 1;
    prevButton.onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderer.renderCourses();
        renderer.renderPagination();
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
    };
    fragment.appendChild(prevButton);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= state.currentPage - 1 && i <= state.currentPage + 1)
      ) {
        const pageButton = document.createElement('button');
        pageButton.className = `px-3 py-1 rounded ${
          i === state.currentPage 
            ? 'bg-blue-600 text-white' 
            : 'bg-white hover:bg-gray-50'
        }`;
        pageButton.textContent = i;
        pageButton.onclick = () => {
          state.currentPage = i;
          renderer.renderCourses();
          renderer.renderPagination();
          window.scrollTo({top: 0, behavior: 'smooth'});
        };
        fragment.appendChild(pageButton);
      } else if (
        i === state.currentPage - 2 || 
        i === state.currentPage + 2
      ) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'px-2';
        ellipsis.textContent = '...';
        fragment.appendChild(ellipsis);
      }
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = `px-3 py-1 rounded ${
      state.currentPage === totalPages 
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
        : 'bg-white hover:bg-gray-50'
    }`;
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = state.currentPage === totalPages;
    nextButton.onclick = () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderer.renderCourses();
        renderer.renderPagination();
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
    };
    fragment.appendChild(nextButton);
    
    elements.pagination.innerHTML = '';
    elements.pagination.appendChild(fragment);
  },
  
  updateStatistics: () => {
    elements.totalCourses.textContent = state.allCourses.length;
    elements.activeCourses.textContent = 
      state.allCourses.filter(c => c.status === 'Active').length;
    elements.advancedCourses.textContent = 
      state.allCourses.filter(c => 
        ['Advanced', 'Expert'].includes(c.level)
      ).length;
  }
};

// Data loading with multiple fallback strategies
async function tryFetchJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function readInlineJsonScript() {
  try {
    const el = document.getElementById('allCoursesData');
    if (!el) return null;
    const jsonText = el.textContent || el.innerText || '';
    if (!jsonText.trim()) return null;
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed parsing inline JSON script:', e);
    return null;
  }
}

// Primary loader that tries multiple candidate locations and fallbacks.
async function loadCourses() {
  state.loading = true;
  elements.loadingState.classList.remove('hidden');
  try {
    // 1) Check window global (some WP users inject via inline script)
    if (window.allCoursesData && Array.isArray(window.allCoursesData) && window.allCoursesData.length) {
      console.info('Loaded courses from window.allCoursesData');
      state.allCourses = window.allCoursesData;
      state.filteredCourses = [...state.allCourses];
      return true;
    }

    // 2) Check inline <script id="allCoursesData"> JSON (recommended for WP file manager)
    const inline = readInlineJsonScript();
    if (inline && Array.isArray(inline) && inline.length) {
      console.info('Loaded courses from inline script #allCoursesData');
      state.allCourses = inline;
      state.filteredCourses = [...state.allCourses];
      return true;
    }

    // 3) Try a list of candidate URLs relative to current page
    const candidates = [
      // configured API / data path
      CONFIG.DATA_URL,
      // common locations when uploaded to WP file manager
      './all_courses.json',
      'all_courses.json',
      '../all_courses.json',
      '/all_courses.json',
      './data/all_courses.json',
      '../data/all_courses.json',
      '/wp-content/uploads/all_courses.json'
    ];

    const debugMessages = [];
    for (const url of candidates) {
      if (!url) continue;
      debugMessages.push(`Trying: ${url}`);
      const data = await tryFetchJson(url);
      if (data && Array.isArray(data) && data.length) {
        console.info('Loaded courses from', url);
        debugMessages.push(`Loaded from ${url}`);
        state.allCourses = data;
        state.filteredCourses = [...state.allCourses];
        updateDebugPanel(debugMessages);
        return true;
      } else {
        debugMessages.push(`No data at ${url}`);
      }
    }

    // 4) If grouped source is configured, try to fetch grouped and flatten
    if (CONFIG.GROUPED_URL) {
      const groupedCandidates = [
        CONFIG.GROUPED_URL,
        './courses_grouped.json',
        '../courses_grouped.json',
        '/courses_grouped.json',
        './data/courses_grouped.json',
        '../data/courses_grouped.json'
      ];
      for (const gURL of groupedCandidates) {
        const grouped = await tryFetchJson(gURL);
        if (grouped) {
          // flatten grouped object (tracks/domains)
          const buckets = [].concat(
            ...(Object.values(grouped.tracks || {})),
            ...(Object.values(grouped.domains || {}))
          );
          if (buckets && buckets.length) {
        console.info('Loaded courses from grouped JSON', gURL);
        debugMessages.push(`Loaded grouped from ${gURL}`);
            state.allCourses = buckets;
            state.filteredCourses = [...state.allCourses];
        updateDebugPanel(debugMessages);
            return true;
          }
        }
      }
    }

    // Nothing worked
    console.warn('No course data found in any candidate location');
    utils.showToast('No course data found. See console for attempted paths.', 'error');
    updateDebugPanel(debugMessages.concat(['No data found in any candidate location']));
    return false;
  } catch (error) {
    console.error('Error loading courses:', error);
    utils.showToast('Failed to load courses. See console for details.', 'error');
    return false;
  } finally {
    state.loading = false;
    elements.loadingState.classList.add('hidden');
  }
}

function updateDebugPanel(messages) {
  try {
    const panel = document.getElementById('listingDebugPanel');
    const container = document.getElementById('debugMessages');
    if (!panel || !container) return;
    panel.classList.remove('hidden');
    container.innerHTML = messages.map(m => `<div>${m}</div>`).join('');
  } catch (e) {
    console.error('Failed to update debug panel', e);
  }
}

// Initialize the application
async function init() {
  console.log('Initializing application...');
  
  // Show loading state
  elements.loadingState.classList.remove('hidden');
  
  try {
    // Load courses
    const success = await loadCourses();
    if (!success) {
      throw new Error('Failed to load courses');
    }

    console.log(`Loaded ${state.allCourses.length} courses`);

    // Initialize filters
    const tracks = [...new Set(state.allCourses.map(c => c.track))].sort();
    const domains = [...new Set(state.allCourses.map(c => c.domain))].sort();
    const levels = [...new Set(state.allCourses.map(c => c.level))].sort();
    
    // Populate filter dropdowns
    tracks.forEach(track => {
      const option = document.createElement('option');
      option.value = track;
      option.textContent = track;
      elements.trackFilter.appendChild(option);
    });

    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      elements.domainFilter.appendChild(option);
    });

    levels.forEach(level => {
      const option = document.createElement('option');
      option.value = level;
      option.textContent = level;
      elements.levelFilter.appendChild(option);
    });

    // Set up event listeners
    elements.searchInput.addEventListener('input', utils.debounce(() => {
      state.filters.search = elements.searchInput.value;
      applyFilters();
    }, 300));

    elements.trackFilter.addEventListener('change', () => {
      state.filters.track = elements.trackFilter.value;
      applyFilters();
    });

    elements.levelFilter.addEventListener('change', () => {
      state.filters.level = elements.levelFilter.value;
      applyFilters();
    });

    elements.domainFilter.addEventListener('change', () => {
      state.filters.domain = elements.domainFilter.value;
      applyFilters();
    });

    elements.sortBy.addEventListener('change', () => {
      state.filters.sortBy = elements.sortBy.value;
      applyFilters();
    });

    // Toggle advanced filters
    const advancedFiltersToggle = document.getElementById('advancedFiltersToggle');
    if (advancedFiltersToggle) {
      advancedFiltersToggle.addEventListener('click', () => {
        const advancedFilters = document.getElementById('advancedFilters');
        advancedFilters.classList.toggle('hidden');
        const icon = advancedFiltersToggle.querySelector('i');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
      });
    }

    // Initial render
    renderer.updateStatistics();
    renderer.renderCourses();
    renderer.renderPagination();

  } catch (error) {
    console.error('Initialization error:', error);
    utils.showToast('Failed to initialize the application. Please refresh the page.', 'error');
  } finally {
    elements.loadingState.classList.add('hidden');
  }
}

// Filter application
function applyFilters() {
  state.filteredCourses = state.allCourses.filter(course => {
    const searchMatch = !state.filters.search || 
      course.title.toLowerCase().includes(state.filters.search.toLowerCase()) ||
      course.description.toLowerCase().includes(state.filters.search.toLowerCase());
    
    const trackMatch = !state.filters.track || 
      course.track === state.filters.track;
    
    const domainMatch = !state.filters.domain || 
      course.domain === state.filters.domain;
    
    const levelMatch = !state.filters.level || 
      course.level === state.filters.level;
    
    return searchMatch && trackMatch && domainMatch && levelMatch;
  });

  // Apply sorting
  switch (state.filters.sortBy) {
    case 'popular':
      state.filteredCourses.sort((a, b) => b.students - a.students);
      break;
    case 'rating':
      state.filteredCourses.sort((a, b) => b.rating - a.rating);
      break;
    case 'priceAsc':
      state.filteredCourses.sort((a, b) => {
        const priceA = Math.min(...Object.values(a.pricing || {}).map(p => p.inr || Infinity));
        const priceB = Math.min(...Object.values(b.pricing || {}).map(p => p.inr || Infinity));
        return priceA - priceB;
      });
      break;
    case 'priceDesc':
      state.filteredCourses.sort((a, b) => {
        const priceA = Math.min(...Object.values(a.pricing || {}).map(p => p.inr || Infinity));
        const priceB = Math.min(...Object.values(b.pricing || {}).map(p => p.inr || Infinity));
        return priceB - priceA;
      });
      break;
    case 'title':
      state.filteredCourses.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  state.currentPage = 1;
  renderer.renderCourses();
  renderer.renderPagination();
}

// Start the application
document.addEventListener('DOMContentLoaded', init);