const fs = require('fs');

// Read the courses data
const rawData = fs.readFileSync('./all_courses.json');
const courses = JSON.parse(rawData);

// Update course IDs and status
courses.forEach((course, index) => {
    // Create sequential AI-n ID
    const newId = `AI-${index + 1}`;
    course.id = newId;
    
    // Update enrollment URL with new ID
    course.enrollmentUrl = `https://nanoschool.in/ai-course/registration/?pid=${newId}`;
    
    // Standardize status to Active
    course.status = "Active";
});

// Write the updated courses back to file
fs.writeFileSync('./all_courses.json', JSON.stringify(courses, null, 2));

// Regenerate the grouped courses file
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

// Group courses by track first
const trackGroups = {};

courses.forEach(course => {
    const track = course.track || 'Uncategorized';
    
    // Initialize track if not exists
    if (!trackGroups[track]) {
        trackGroups[track] = {
            track,
            isIndustryTrack: industryTracks.includes(track),
            domains: {},
            courses: []
        };
    }
    
    // Add to track's courses
    trackGroups[track].courses.push(course);
    
    // Group by domain within track
    const domain = course.domain || 'Uncategorized';
    if (!trackGroups[track].domains[domain]) {
        trackGroups[track].domains[domain] = [];
    }
    trackGroups[track].domains[domain].push(course);
});

// Convert to final structure with separate industry and regular tracks
const groupedData = {
    industryTracks: [],
    regularTracks: [],
    totalCourses: courses.length
};

// Process tracks and sort them into industry and regular
Object.values(trackGroups).forEach(track => {
    const trackData = {
        ...track,
        domains: Object.entries(track.domains).map(([name, courses]) => ({
            name,
            courses,
            courseCount: courses.length
        })),
        courseCount: track.courses.length
    };

    if (track.isIndustryTrack) {
        groupedData.industryTracks.push(trackData);
    } else {
        groupedData.regularTracks.push(trackData);
    }
});

// Sort tracks alphabetically
groupedData.industryTracks.sort((a, b) => a.track.localeCompare(b.track));
groupedData.regularTracks.sort((a, b) => a.track.localeCompare(b.track));

// Write the grouped data to file
fs.writeFileSync('./courses_grouped.json', JSON.stringify(groupedData, null, 2));

console.log('Course IDs and status have been updated successfully!');