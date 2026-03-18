import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Ensure the output directory exists
const outputDir = path.join('www', 'data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Read and parse the index.json file
const indexFilePath = 'index.json';
const indexData = JSON.parse(fs.readFileSync(indexFilePath, 'utf8'));
const minorNames = Object.keys(indexData.meta.minorBitMask || {});

// Extract all domains url/name tuples
// - Filter out Wordpress wfw comment feeds
// - Strip https:// protocol from URLs
// - Only first 3 feeds per url
let feedCount = 0;
let countByFeedType = {};
let countByNS = {};
let countByTLD = {};
let countByProtocol = { http: 0, https: 0, gopher: 0 };
let countByMedia = { audio: 0, video: 0 };
let countByMinor = {};
let urlTitle = {};
Object.entries(indexData.urls).forEach(([url, feeds]) => {
    feeds.forEach((feed, i) => {
        // Skip outdated feeds
        if (feed.c && (Date.now() / 1000 - feed.c) > 365 * 24 * 3600)
            return;

        if (!urlTitle[url])
            urlTitle[url] = [];

        // Statistic counting
        const tld = (new URL(url.includes('://') ? url : `https://${url}`)).hostname.split('.').slice(-1)[0];
        const protocol = feed.u.split(':')[0];
        countByProtocol[protocol] = (countByProtocol[protocol] || 0) + 1;
        countByTLD[tld] = (countByTLD[tld] || 0) + 1;
        countByFeedType[feed.f] = (countByFeedType[feed.f] || 0) + 1;
        countByMedia.audio += (feed.m && feed.m & 1) ? 1 : 0;
        countByMedia.video += (feed.m && feed.m & 2) ? 1 : 0;
        if (feed.M) {
            let m = feed.M;
            let idx = 0;
            while (m > 0 && idx < minorNames.length) {
                if (m % 2 === 1) {
                    countByMinor[minorNames[idx]] = (countByMinor[minorNames[idx]] || 0) + 1;
                }
                m = Math.floor(m / 2);
                idx++;
            }
        }
        (feed.ns || []).forEach(ns => {
            countByNS[ns] = (countByNS[ns] || 0) + 1;
        });

        if (i > 2)
            return;
        if (feed.u.includes('/comments/feed'))
            return;

        const name = (feed.n || '').trim();
        let feedUrl = feed.u.startsWith('https://') ? feed.u.slice(8) : feed.u; // Strip https://
        if (feedUrl.startsWith(url))
            feedUrl = feedUrl.slice(url.length);

        urlTitle[url].push({
            u: feedUrl,
            n: name,
            M: feed.M ? feed.M : undefined,                     // minor bitmask
            m: feed.m ? feed.m : undefined,                     // media present
            t: (feed.t > 15 * 500) ? 1 : undefined              // flag for long-text
        });
        feedCount++;
    });
});

// Write the url-title.json file
const urlTitlePath = path.join(outputDir, 'url-title.json');
fs.writeFileSync(urlTitlePath, JSON.stringify(urlTitle));

// Update meta.json
const meta = {
    ...indexData.meta,
    urls: Object.keys(indexData.urls).length,
    feeds: feedCount,
    blogrolls: Object.keys(indexData.blogrolls).length,
    minorBitMask: Object.fromEntries(
        Object.entries(indexData.meta.minorBitMask || {}).map(([k, v]) => [v, k])
    ),
    byFeedType: countByFeedType,
    byNS: countByNS,
    byTLD: countByTLD,
    byProtocol: countByProtocol,
    byMedia: countByMedia,
    byMinor: countByMinor,
    lastUpdated: Math.floor(Date.now() / 1000)
};
const metaPath = path.join(outputDir, 'meta.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

// Update blogroll index
const blogrollPath = path.join(outputDir, 'blogroll.json');
const blogrollData = {
    blogrolls: indexData.blogrolls,
    count: Object.keys(indexData.blogrolls).length,
    lastUpdated: Math.floor(Date.now() / 1000)
};
fs.writeFileSync(blogrollPath, JSON.stringify(blogrollData, null, 2));

// Create a bucket index of max 100x100 buckets representing
// properties of feeds in this bucket:
// - average update age
// - average index add age
const now = Math.floor(Date.now() / 1000);
const bucketIndex = {};
const urlCount = Object.keys(indexData.urls).length;
const bucketSize = Math.floor(urlCount / (2500));
let i = 0;
Object.entries(indexData.urls).forEach(([url, feeds]) => {
    i++;
    const bucketKey = `${Math.floor(i / bucketSize) * bucketSize}-${Math.floor(i / bucketSize) * bucketSize + bucketSize}`;
    if (!bucketIndex[bucketKey]) {
        bucketIndex[bucketKey] = {
            sumTimestamps: 0,        // sum of seconds since feeds last updated
            count: 0
        };
    }

    for (const feed of feeds) {
        if (feed.d && feed.d > 0) {
            bucketIndex[bucketKey].sumTimestamps += feed.d;
            bucketIndex[bucketKey].count++;
        }
    }
});

// Calculate average age in days        
for (const b of Object.values(bucketIndex)) {
    b.avg = Math.floor(b.sumTimestamps / b.count);
    delete b.sumTimestamps;
    delete b.count;
};

// Write the bucket index to a file
const bucketIndexPath = path.join(outputDir, 'bucket-index.json');
fs.writeFileSync(bucketIndexPath, JSON.stringify({ lastUpdated: now, buckets: bucketIndex }, null, 2));