const fs = require('fs');

// Read the courses data
const rawData = fs.readFileSync('./all_courses.json');
const courses = JSON.parse(rawData);

// Function to convert title to URL slug
function titleToSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
        .trim();
}

// Update course URLs
courses.forEach(course => {
    const slug = titleToSlug(course.title);
    course.mainPageUrl = `https://nanoschool.in/ai/courses/${slug}/`;
});

// Write the updated courses back to file
fs.writeFileSync('./all_courses.json', JSON.stringify(courses, null, 2));

console.log('Course URLs have been updated successfully!');