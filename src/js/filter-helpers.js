// Enhanced filter utilities and helper functions
const FilterHelpers = {
  // Price range filtering
  getPriceRanges() {
    return [
      { min: 0, max: 10000, label: 'Under ₹10,000' },
      { min: 10000, max: 25000, label: '₹10,000 - ₹25,000' },
      { min: 25000, max: 50000, label: '₹25,000 - ₹50,000' },
      { min: 50000, max: Infinity, label: 'Above ₹50,000' }
    ];
  },

  // Get minimum price for a course across all pricing options
  getMinPrice(course) {
    if (!course.pricing) return Infinity;
    return Math.min(
      course.pricing.lms?.inr || Infinity,
      course.pricing.lms_video?.inr || Infinity,
      course.pricing.lms_video_live?.inr || Infinity
    );
  },

  // Advanced search with boosted relevance scoring
  searchWithRelevance(courses, searchTerm) {
    if (!searchTerm) return courses;
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const words = normalizedSearch.split(/\s+/);
    
    return courses
      .map(course => {
        let score = 0;
        const title = course.title.toLowerCase();
        const description = course.description.toLowerCase();
        
        // Title matches (highest weight)
        if (title.includes(normalizedSearch)) score += 100;
        words.forEach(word => {
          if (title.includes(word)) score += 50;
        });
        
        // Description matches
        if (description.includes(normalizedSearch)) score += 30;
        words.forEach(word => {
          if (description.includes(word)) score += 15;
        });
        
        // Tool/technology matches
        if (course.tool) {
          const tools = course.tool.toLowerCase();
          words.forEach(word => {
            if (tools.includes(word)) score += 25;
          });
        }
        
        // Domain/track matches
        if (course.domain.toLowerCase().includes(normalizedSearch)) score += 40;
        if (course.track.toLowerCase().includes(normalizedSearch)) score += 40;
        
        return { course, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.course);
  },

  // Filter by multiple criteria
  multiFilter(courses, criteria) {
    return courses.filter(course => {
      // Search text
      if (criteria.search) {
        const searchInFields = [
          course.title,
          course.description,
          course.tool,
          course.domain,
          course.track
        ].map(field => (field || '').toLowerCase());
        
        const searchTerms = criteria.search.toLowerCase().split(/\s+/);
        const matchesSearch = searchTerms.every(term =>
          searchInFields.some(field => field.includes(term))
        );
        
        if (!matchesSearch) return false;
      }
      
      // Track
      if (criteria.track && course.track !== criteria.track) return false;
      
      // Domain
      if (criteria.domain && course.domain !== criteria.domain) return false;
      
      // Level
      if (criteria.level && course.level !== criteria.level) return false;
      
      // Duration
      if (criteria.duration) {
        const courseDuration = parseInt(course.duration) || 0;
        if (courseDuration !== parseInt(criteria.duration)) return false;
      }
      
      // Price range
      if (criteria.priceRange) {
        const minPrice = this.getMinPrice(course);
        if (minPrice < criteria.priceRange.min || minPrice > criteria.priceRange.max) {
          return false;
        }
      }
      
      // Status
      if (criteria.status && course.status !== criteria.status) return false;
      
      // Rating threshold
      if (criteria.minRating && course.rating < criteria.minRating) return false;
      
      return true;
    });
  },

  // Sort courses by various criteria
  sortCourses(courses, sortBy) {
    const sortFunctions = {
      popular: (a, b) => b.students - a.students,
      rating: (a, b) => b.rating - a.rating,
      priceAsc: (a, b) => this.getMinPrice(a) - this.getMinPrice(b),
      priceDesc: (a, b) => this.getMinPrice(b) - this.getMinPrice(a),
      newest: (a, b) => parseInt(b.id.split('-')[1]) - parseInt(a.id.split('-')[1]),
      title: (a, b) => a.title.localeCompare(b.title),
      duration: (a, b) => {
        const durationA = parseInt(a.duration) || 0;
        const durationB = parseInt(b.duration) || 0;
        return durationA - durationB;
      }
    };

    return [...courses].sort(sortFunctions[sortBy] || sortFunctions.popular);
  },

  // Group courses by various criteria
  groupCourses(courses, groupBy) {
    return courses.reduce((groups, course) => {
      const key = course[groupBy];
      if (!groups[key]) groups[key] = [];
      groups[key].push(course);
      return groups;
    }, {});
  },

  // Get unique values for a field across all courses
  getUniqueValues(courses, field) {
    return [...new Set(courses.map(course => course[field]))].filter(Boolean).sort();
  },

  // Calculate statistics for a set of courses
  calculateStats(courses) {
    return {
      total: courses.length,
      active: courses.filter(c => c.status === 'Active').length,
      advanced: courses.filter(c => ['Advanced', 'Expert'].includes(c.level)).length,
      averageRating: courses.reduce((sum, c) => sum + c.rating, 0) / courses.length,
      totalStudents: courses.reduce((sum, c) => sum + c.students, 0),
      byLevel: this.groupCourses(courses, 'level'),
      byDomain: this.groupCourses(courses, 'domain'),
      byTrack: this.groupCourses(courses, 'track')
    };
  }
};

// Export the helpers
export default FilterHelpers;