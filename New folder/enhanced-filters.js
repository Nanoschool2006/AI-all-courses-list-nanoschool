// Enhanced filtering system

// Track current filter state
const filterState = {
    track: null,
    domain: null,
    levels: new Set(),
    durations: new Set(),
    tools: new Set(),
    search: '',
    activeFilters: new Set()
};

// Initialize enhanced filters
function initEnhancedFilters() {
    setupTrackFilters();
    setupDomainFilters();
    setupToolFilters();
    setupEventListeners();
    updateFilterCounts();
}

// Setup track filters with nested domains
function setupTrackFilters() {
    const industryContainer = document.getElementById('industryTrackFilters');
    const regularContainer = document.getElementById('regularTrackFilters');
    
    // Clear containers
    industryContainer.innerHTML = '';
    regularContainer.innerHTML = '';
    
    // Process industry tracks
    groupedData.industryTracks.forEach(track => {
        const trackElement = createTrackFilterElement(track, true);
        industryContainer.appendChild(trackElement);
    });
    
    // Process regular tracks
    groupedData.regularTracks.forEach(track => {
        const trackElement = createTrackFilterElement(track, false);
        regularContainer.appendChild(trackElement);
    });
}

// Create track filter element with nested domains
function createTrackFilterElement(track, isIndustry) {
    const div = document.createElement('div');
    div.className = 'mb-2';
    
    const trackName = track.track;
    const courseCount = track.courses.length;
    const bgClass = isIndustry ? 'hover:bg-purple-100' : 'hover:bg-blue-100';
    
    div.innerHTML = `
        <div class="flex items-center justify-between ${bgClass} rounded px-2 py-1 cursor-pointer group">
            <label class="flex items-center cursor-pointer flex-grow">
                <input type="radio" name="track" value="${trackName}" class="track-filter mr-2">
                <span class="text-sm flex-grow">${trackName}</span>
                <span class="text-xs text-gray-500">${courseCount}</span>
            </label>
            <button class="expand-domains text-xs text-gray-500 hover:text-gray-700 ml-2 opacity-0 group-hover:opacity-100">
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>
        <div class="nested-domains ml-6 mt-1 hidden">
            ${track.domains.map(domain => `
                <label class="flex items-center text-sm py-1 cursor-pointer">
                    <input type="checkbox" class="domain-filter mr-2" value="${domain.name}">
                    <span class="flex-grow">${domain.name}</span>
                    <span class="text-xs text-gray-500">${domain.courses.length}</span>
                </label>
            `).join('')}
        </div>
    `;
    
    // Add event listeners
    const expandBtn = div.querySelector('.expand-domains');
    const nestedDomains = div.querySelector('.nested-domains');
    expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        nestedDomains.classList.toggle('hidden');
        expandBtn.querySelector('i').classList.toggle('fa-chevron-down');
        expandBtn.querySelector('i').classList.toggle('fa-chevron-up');
    });
    
    return div;
}

// Setup domain filters
function setupDomainFilters() {
    const container = document.getElementById('domainFilters');
    container.innerHTML = '';
    
    // Collect all unique domains with their total counts
    const domainCounts = new Map();
    [...groupedData.industryTracks, ...groupedData.regularTracks].forEach(track => {
        track.domains.forEach(domain => {
            const count = domainCounts.get(domain.name) || 0;
            domainCounts.set(domain.name, count + domain.courses.length);
        });
    });
    
    // Create sorted domain filters
    Array.from(domainCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([domain, count]) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between hover:bg-green-100 rounded px-2 py-1';
            div.innerHTML = `
                <label class="flex items-center cursor-pointer flex-grow">
                    <input type="checkbox" class="domain-filter mr-2" value="${domain}">
                    <span class="text-sm flex-grow">${domain}</span>
                    <span class="text-xs text-gray-500">${count}</span>
                </label>
            `;
            container.appendChild(div);
        });
}

// Populate domain filters for a specific track (or all if track is null)
function populateDomainFiltersForTrack(trackName) {
    const container = document.getElementById('domainFilters');
    container.innerHTML = '';
    if (!trackName) {
        // no track selected -> default behavior
        setupDomainFilters();
        return;
    }
    const track = findTrackByName(trackName);
    if (!track || !track.domains || !track.domains.length) {
        container.innerHTML = '<div class="text-sm text-gray-500">No domains in this track.</div>';
        return;
    }
    track.domains.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(domain => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between hover:bg-green-100 rounded px-2 py-1';
        div.innerHTML = `
            <label class="flex items-center cursor-pointer flex-grow">
                <input type="checkbox" class="domain-filter mr-2" value="${domain.name}">
                <span class="text-sm flex-grow">${domain.name}</span>
                <span class="text-xs text-gray-500">${domain.courses.length}</span>
            </label>
        `;
        container.appendChild(div);
        // attach change listener
        const cb = div.querySelector('input.domain-filter');
        if (cb) {
            cb.addEventListener('change', () => {
                if (cb.checked) addActiveFilter('domain', cb.value);
                else removeFilter('domain', cb.value);
                applyFilters();
            });
        }
    });
}

// Populate tool filters for a specific track (or all if track is null)
function populateToolFiltersForTrack(trackName) {
    const container = document.getElementById('toolFilters');
    container.innerHTML = '';
    let toolCounts = new Map();
    if (!trackName) {
        // default to global tool list
        setupToolFilters();
        return;
    }
    const track = findTrackByName(trackName);
    if (!track) {
        container.innerHTML = '<div class="text-sm text-gray-500">No tools in this track.</div>';
        return;
    }
    // collect tools from courses within this track
    track.domains.forEach(domain => {
        domain.courses.forEach(course => {
            if (!course.tool) return;
            // handle comma-separated tools
            const tools = course.tool.split(',').map(t => t.trim()).filter(Boolean);
            tools.forEach(t => {
                const count = toolCounts.get(t) || 0;
                toolCounts.set(t, count + 1);
            });
        });
    });
    if (toolCounts.size === 0) {
        container.innerHTML = '<div class="text-sm text-gray-500">No tools in this track.</div>';
        return;
    }
    Array.from(toolCounts.entries()).sort((a,b)=>b[1]-a[1]).forEach(([tool,count]) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between hover:bg-gray-100 rounded px-2 py-1';
        div.innerHTML = `
            <label class="flex items-center cursor-pointer flex-grow">
                <input type="checkbox" class="tool-filter mr-2" value="${tool}">
                <span class="text-sm flex-grow">${tool}</span>
                <span class="text-xs text-gray-500">${count}</span>
            </label>
        `;
        container.appendChild(div);
        // attach change listener
        const cb = div.querySelector('input.tool-filter');
        if (cb) {
            cb.addEventListener('change', () => {
                if (cb.checked) filterState.tools.add(cb.value);
                else filterState.tools.delete(cb.value);
                if (cb.checked) addActiveFilter('tool', cb.value);
                else removeFilter('tool', cb.value);
                applyFilters();
            });
        }
    });
}

// Find a track object by name in groupedData
function findTrackByName(name) {
    const all = [...groupedData.industryTracks, ...groupedData.regularTracks];
    return all.find(t => t.track === name);
}

// Setup tool filters
function setupToolFilters() {
    const container = document.getElementById('toolFilters');
    container.innerHTML = '';
    
    // Collect and count all tools
    const toolCounts = new Map();
    allCourses.forEach(course => {
        if (!course.tool) return;
        const tools = course.tool.split(',').map(t => t.trim());
        tools.forEach(tool => {
            const count = toolCounts.get(tool) || 0;
            toolCounts.set(tool, count + 1);
        });
    });
    
    // Create sorted tool filters
    Array.from(toolCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .forEach(([tool, count]) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between hover:bg-gray-100 rounded px-2 py-1';
            div.innerHTML = `
                <label class="flex items-center cursor-pointer flex-grow">
                    <input type="checkbox" class="tool-filter mr-2" value="${tool}">
                    <span class="text-sm flex-grow">${tool}</span>
                    <span class="text-xs text-gray-500">${count}</span>
                </label>
            `;
            container.appendChild(div);
        });
}

// Update filter counts
function updateFilterCounts() {
    // Update level counts
    ['Beginner', 'Intermediate', 'Advanced', 'Expert'].forEach(level => {
        const count = filteredCourses.filter(c => c.level === level).length;
        const countElement = document.getElementById(`${level.toLowerCase()}Count`);
        if (countElement) {
            countElement.textContent = `(${count})`;
        }
    });
    
    // Update duration counts
    const durationRanges = {
        '0-2': c => weeksToNum(c.duration) <= 2,
        '2-5': c => weeksToNum(c.duration) > 2 && weeksToNum(c.duration) <= 5,
        '5-10': c => weeksToNum(c.duration) > 5 && weeksToNum(c.duration) <= 10,
        '10+': c => weeksToNum(c.duration) > 10
    };
    
    Object.entries(durationRanges).forEach(([range, condition]) => {
        const count = filteredCourses.filter(condition).length;
        const countElement = document.getElementById(`duration${range.replace('-', '')}Count`);
        if (countElement) {
            countElement.textContent = `(${count})`;
        }
    });
}

// Add active filter tag
function addActiveFilter(type, value) {
    const id = `filter-${type}-${value}`;
    if (document.getElementById(id)) return;
    
    const container = document.getElementById('activeFilters');
    const tag = document.createElement('div');
    tag.id = id;
    tag.className = 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2';
    tag.innerHTML = `
        <span>${value}</span>
        <button class="hover:text-blue-600" onclick="removeFilter('${type}', '${value}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(tag);
    filterState.activeFilters.add(id);
}

// Remove active filter
function removeFilter(type, value) {
    const id = `filter-${type}-${value}`;
    document.getElementById(id)?.remove();
    filterState.activeFilters.delete(id);
    
    // Uncheck/clear the corresponding filter
    switch (type) {
        case 'track':
            document.querySelector(`input[name="track"][value="${value}"]`)?.checked = false;
            // restore full domain/tool lists
            populateDomainFiltersForTrack(null);
            populateToolFiltersForTrack(null);
            break;
        case 'domain':
            document.querySelectorAll(`input.domain-filter[value="${value}"]`)
                .forEach(cb => cb.checked = false);
            break;
        case 'level':
            document.querySelector(`input.level-filter[value="${value}"]`).checked = false;
            break;
        case 'duration':
            document.querySelector(`input.duration-filter[value="${value}"]`).checked = false;
            break;
        case 'tool':
            document.querySelector(`input.tool-filter[value="${value}"]`).checked = false;
            break;
    }
    
    applyFilters();
}

// Setup event listeners for enhanced filtering
function setupEventListeners() {
    // Track radio buttons
    document.querySelectorAll('input.track-filter').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                filterState.track = radio.value;
                addActiveFilter('track', radio.value);

                // Show nested domains for selected track
                document.querySelectorAll('.nested-domains').forEach(div => {
                    div.classList.add('hidden');
                });
                radio.closest('.flex').nextElementSibling?.classList.remove('hidden');

                // Repopulate domain and tool filters scoped to selected track
                populateDomainFiltersForTrack(radio.value);
                populateToolFiltersForTrack(radio.value);
            }
            applyFilters();
        });
    });
    
    // Domain checkboxes
    document.querySelectorAll('input.domain-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                addActiveFilter('domain', cb.value);
            } else {
                removeFilter('domain', cb.value);
            }
            applyFilters();
        });
    });
    
    // Level checkboxes
    document.querySelectorAll('input.level-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                filterState.levels.add(cb.value);
                addActiveFilter('level', cb.value);
            } else {
                filterState.levels.delete(cb.value);
                removeFilter('level', cb.value);
            }
            applyFilters();
        });
    });
    
    // Duration checkboxes
    document.querySelectorAll('input.duration-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                filterState.durations.add(cb.value);
                addActiveFilter('duration', cb.value);
            } else {
                filterState.durations.delete(cb.value);
                removeFilter('duration', cb.value);
            }
            applyFilters();
        });
    });
    
    // Tool checkboxes
    document.querySelectorAll('input.tool-filter').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                filterState.tools.add(cb.value);
                addActiveFilter('tool', cb.value);
            } else {
                filterState.tools.delete(cb.value);
                removeFilter('tool', cb.value);
            }
            applyFilters();
        });
    });
    
    // Search input
    const searchInput = document.getElementById('titleFilter');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterState.search = searchInput.value.toLowerCase();
            applyFilters();
        }, 300));
    }
    
    // Clear all filters
    document.getElementById('clearAllFilters')?.addEventListener('click', clearAllFilters);
}

// Apply all filters
function applyFilters() {
    filteredCourses = allCourses.filter(course => {
        // Track filter
        if (filterState.track && course.track !== filterState.track) {
            return false;
        }
        
        // Domain filters
        const selectedDomains = Array.from(document.querySelectorAll('input.domain-filter:checked'))
            .map(cb => cb.value);
        if (selectedDomains.length > 0 && !selectedDomains.includes(course.domain)) {
            return false;
        }
        
        // Level filters
        if (filterState.levels.size > 0 && !filterState.levels.has(course.level)) {
            return false;
        }
        
        // Duration filters
        if (filterState.durations.size > 0) {
            const weeks = weeksToNum(course.duration);
            let matchesDuration = false;
            filterState.durations.forEach(range => {
                switch (range) {
                    case '0-2': if (weeks <= 2) matchesDuration = true; break;
                    case '2-5': if (weeks > 2 && weeks <= 5) matchesDuration = true; break;
                    case '5-10': if (weeks > 5 && weeks <= 10) matchesDuration = true; break;
                    case '10+': if (weeks > 10) matchesDuration = true; break;
                }
            });
            if (!matchesDuration) return false;
        }
        
        // Tool filters
        if (filterState.tools.size > 0) {
            const courseTools = course.tool?.split(',').map(t => t.trim()) || [];
            let hasMatchingTool = false;
            filterState.tools.forEach(tool => {
                if (courseTools.includes(tool)) hasMatchingTool = true;
            });
            if (!hasMatchingTool) return false;
        }
        
        // Search filter
        if (filterState.search) {
            const searchableText = `${course.title} ${course.description} ${course.tool}`.toLowerCase();
            if (!searchableText.includes(filterState.search)) return false;
        }
        
        return true;
    });
    
    currentPage = 1;
    updateListing();
    updateFilterCounts();
}

// Clear all filters
function clearAllFilters() {
    // Clear filter state
    filterState.track = null;
    filterState.domain = null;
    filterState.levels.clear();
    filterState.durations.clear();
    filterState.tools.clear();
    filterState.search = '';
    
    // Clear UI
    document.getElementById('titleFilter').value = '';
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });
    document.querySelectorAll('.nested-domains').forEach(div => {
        div.classList.add('hidden');
    });
    document.getElementById('activeFilters').innerHTML = '';
    filterState.activeFilters.clear();
    
    // Reset to all courses
    filteredCourses = [...allCourses];
    currentPage = 1;
    updateListing();
    // Reset domain and tool filter lists to full
    setupDomainFilters();
    setupToolFilters();
    updateFilterCounts();
}

// Initialize enhanced filters when document loads
document.addEventListener('DOMContentLoaded', () => {
    initEnhancedFilters();
});