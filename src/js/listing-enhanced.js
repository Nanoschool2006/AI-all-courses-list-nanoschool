// Configuration
const CONFIG = {
    DATA_PATHS: [
        '/src/data/all_courses.json',
        '../data/all_courses.json',
        './all_courses.json',
        '/all_courses.json'
    ],
    ITEMS_PER_PAGE: 12
};

// State management
let allCourses = [];
let filteredCourses = [];
let currentPage = 1;
let currentView = "grid";
let preFilterKey = null;
let preFilterValue = null;

// Helper functions
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showLoading(show = true) {
    const loader = document.getElementById('loadingState');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

function normalizeString(value) {
    if (!value) return '';
    return value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .toLowerCase()
        .trim();
}

// Data loading with fallbacks
async function loadCourseData() {
    showLoading(true);
    
    try {
        // Try loading from inline script first
        const inlineData = document.getElementById('courseData');
        if (inlineData && inlineData.textContent) {
            try {
                const data = JSON.parse(inlineData.textContent);
                if (Array.isArray(data) && data.length > 0) {
                    console.log('Loaded course data from inline script');
                    return data;
                }
            } catch (e) {
                console.warn('Failed to parse inline course data:', e);
            }
        }

        // Try loading from multiple possible file locations
        for (const path of CONFIG.DATA_PATHS) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        console.log('Loaded course data from:', path);
                        return data;
                    }
                }
            } catch (e) {
                console.warn('Failed to load from path:', path, e);
            }
        }

        throw new Error('Could not load course data from any source');
    } catch (error) {
        showError('Failed to load course data. Please try refreshing the page.');
        console.error('Course data loading error:', error);
        return null;
    } finally {
        showLoading(false);
    }
}

// Course rendering
function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg';
    
    const levelColors = {
        'Beginner': 'bg-green-100 text-green-800',
        'Intermediate': 'bg-yellow-100 text-yellow-800',
        'Advanced': 'bg-red-100 text-red-800',
        'Expert': 'bg-purple-100 text-purple-800'
    };

    const lowestPrice = course.pricing ? Math.min(
        course.pricing.lms?.inr || Infinity,
        course.pricing.lms_video?.inr || Infinity,
        course.pricing.lms_video_live?.inr || Infinity
    ) : null;

    card.innerHTML = `
        <div class="relative p-4">
            <h3 class="text-lg font-semibold mb-2">${course.title}</h3>
            <span class="absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-medium ${levelColors[course.level] || 'bg-gray-100 text-gray-800'}">
                ${course.level}
            </span>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${course.description}</p>
            
            <div class="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span><i class="far fa-clock mr-1"></i>${course.duration}</span>
                <span><i class="far fa-user mr-1"></i>${course.students.toLocaleString()}</span>
            </div>
            
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                    <div class="text-yellow-400 mr-1">
                        ${('★'.repeat(Math.floor(course.rating)) + '☆'.repeat(5 - Math.floor(course.rating)))}
                    </div>
                    <span class="text-sm text-gray-600">${course.rating.toFixed(1)}</span>
                </div>
                <div class="text-blue-600 font-semibold">
                    ${lowestPrice ? new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR'
                    }).format(lowestPrice) : 'N/A'}
                </div>
            </div>
            
            <a href="${course.enrollmentUrl}" target="_blank" 
               class="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Enroll Now
            </a>
        </div>
    `;
    
    return card;
}

function renderCourses() {
    const container = document.getElementById('coursesGrid');
    const resultsCount = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');
    
    if (!container) {
        console.error('Course grid container not found');
        return;
    }

    container.innerHTML = '';
    
    const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
    const coursesToShow = filteredCourses.slice(startIndex, endIndex);

    if (coursesToShow.length === 0) {
        if (noResults) noResults.style.display = 'block';
        if (resultsCount) resultsCount.textContent = '0';
        return;
    }

    if (noResults) noResults.style.display = 'none';
    if (resultsCount) resultsCount.textContent = filteredCourses.length;

    const fragment = document.createDocumentFragment();
    coursesToShow.forEach(course => {
        fragment.appendChild(createCourseCard(course));
    });

    container.appendChild(fragment);
    updatePagination();
}

// Pagination
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredCourses.length / CONFIG.ITEMS_PER_PAGE);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    const fragment = document.createDocumentFragment();

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = `px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'}`;
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderCourses();
        }
    };
    fragment.appendChild(prevButton);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
            const pageButton = document.createElement('button');
            pageButton.className = `px-3 py-1 rounded ${
                i === currentPage ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'
            }`;
            pageButton.textContent = i;
            pageButton.onclick = () => {
                currentPage = i;
                renderCourses();
            };
            fragment.appendChild(pageButton);
        } else if (
            i === currentPage - 2 ||
            i === currentPage + 2
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
        currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50'
    }`;
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderCourses();
        }
    };
    fragment.appendChild(nextButton);

    paginationContainer.appendChild(fragment);
}

// Filtering
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const trackFilter = document.getElementById('trackFilter');
    const levelFilter = document.getElementById('levelFilter');
    const domainFilter = document.getElementById('domainFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCourses);
    }
    if (trackFilter) {
        // Populate track options
        const tracks = [...new Set(allCourses.map(c => c.track))].sort();
        tracks.forEach(track => {
            const option = document.createElement('option');
            option.value = track;
            option.textContent = track;
            trackFilter.appendChild(option);
        });
        trackFilter.addEventListener('change', filterCourses);
    }
    if (levelFilter) {
        levelFilter.addEventListener('change', filterCourses);
    }
    if (domainFilter) {
        // Populate domain options
        const domains = [...new Set(allCourses.map(c => c.domain))].sort();
        domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            domainFilter.appendChild(option);
        });
        domainFilter.addEventListener('change', filterCourses);
    }
}

function filterCourses() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const selectedTrack = document.getElementById('trackFilter')?.value || '';
    const selectedLevel = document.getElementById('levelFilter')?.value || '';
    const selectedDomain = document.getElementById('domainFilter')?.value || '';

    filteredCourses = allCourses.filter(course => {
        const matchesSearch = !searchTerm ||
            course.title.toLowerCase().includes(searchTerm) ||
            course.description.toLowerCase().includes(searchTerm) ||
            course.tool.toLowerCase().includes(searchTerm);
            
        const matchesTrack = !selectedTrack || course.track === selectedTrack;
        const matchesLevel = !selectedLevel || course.level === selectedLevel;
        const matchesDomain = !selectedDomain || course.domain === selectedDomain;

        return matchesSearch && matchesTrack && matchesLevel && matchesDomain;
    });

    currentPage = 1;
    renderCourses();
}

// Initialize
async function initializeListing() {
    const data = await loadCourseData();
    if (!data) return;

    allCourses = data;
    filteredCourses = [...allCourses];

    setupFilters();
    renderCourses();

    // Update stats
    const totalCoursesEl = document.getElementById('totalCourses');
    const activeCoursesEl = document.getElementById('activeCourses');
    const advancedCoursesEl = document.getElementById('advancedCourses');

    if (totalCoursesEl) totalCoursesEl.textContent = allCourses.length;
    if (activeCoursesEl) activeCoursesEl.textContent = allCourses.filter(c => c.status === 'Active').length;
    if (advancedCoursesEl) {
        advancedCoursesEl.textContent = allCourses.filter(c => 
            ['Advanced', 'Expert'].includes(c.level)
        ).length;
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeListing);