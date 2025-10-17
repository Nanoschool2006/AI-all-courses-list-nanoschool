const fs = require('fs');

const USD_LMS_PER_WEEK = 19;
const INR_LMS_PER_WEEK = 1499;
const USD_VIDEO_ADDON = 60;
const INR_VIDEO_ADDON = 6000;
const USD_LIVE_PER_LECTURE = 60;
const INR_LIVE_PER_LECTURE = 5000;

const rawData = fs.readFileSync('./all_courses.json');
const courses = JSON.parse(rawData);

courses.forEach(course => {
    // Extract number of weeks from duration
    let weeks = 1;
    if (course.duration) {
        const match = course.duration.match(/(\d+)/);
        if (match) weeks = parseInt(match[1], 10);
    }
    // LMS only
    const lms_usd = weeks * USD_LMS_PER_WEEK;
    const lms_inr = weeks * INR_LMS_PER_WEEK;
    // LMS + Video
    const lms_video_usd = lms_usd + USD_VIDEO_ADDON;
    const lms_video_inr = lms_inr + INR_VIDEO_ADDON;
    // LMS + Video + Live (per week, 1 lecture per week, double for week 2, then same)
    let live_usd = lms_video_usd;
    let live_inr = lms_video_inr;
    if (weeks === 1) {
        live_usd += USD_LIVE_PER_LECTURE;
        live_inr += INR_LIVE_PER_LECTURE;
    } else if (weeks === 2) {
        live_usd += 2 * USD_LIVE_PER_LECTURE;
        live_inr += 2 * INR_LIVE_PER_LECTURE;
    } else if (weeks > 2) {
        live_usd += 2 * USD_LIVE_PER_LECTURE + (weeks - 2) * USD_LIVE_PER_LECTURE;
        live_inr += 2 * INR_LIVE_PER_LECTURE + (weeks - 2) * INR_LIVE_PER_LECTURE;
    }
    course.pricing = {
        weeks,
        lms: { usd: lms_usd, inr: lms_inr },
        lms_video: { usd: lms_video_usd, inr: lms_video_inr },
        lms_video_live: { usd: live_usd, inr: live_inr }
    };
});

fs.writeFileSync('./all_courses.json', JSON.stringify(courses, null, 2));
console.log('Pricing added to all courses!');
