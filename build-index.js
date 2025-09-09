import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { url } from 'inspector';

// Ensure the output directory exists
const outputDir = path.join('www', 'data');
if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
}

// Read and parse the index.json file
const indexFilePath = 'index.json';
const indexData = JSON.parse(fs.readFileSync(indexFilePath, 'utf8'));

// Extract all domains url/name tuples
// - Filter out Wordpress wfw comment feeds
// - Strip https:// protocol from URLs
// - Only first 3 feeds per domain
let urlTitle = {};
Object.values(indexData.domains).forEach(domain => {
        domain.forEach((feed, i) => {
                if (i > 2)
                        return;
                const name = (feed.n || '').trim();
                const url = feed.u.startsWith('https://') ? feed.u.slice(8) : feed.u; // Strip https://
                urlTitle[url] = name;
        });
});

urlTitle = Object.entries(urlTitle).reduce((acc, [u, n]) => {
        if (!u.includes('/comments/feed')) {
                acc[u] = n;
        }
        return acc;
}, {});

// Write the url-title.json file
const urlTitlePath = path.join(outputDir, 'url-title.json');
fs.writeFileSync(urlTitlePath, JSON.stringify(urlTitle, null, 2));

// Calculate domain and feed counts
const domainCount = Object.keys(indexData.domains).length;
const feedCount = Object.keys(urlTitle).length;

// Update meta.json
const meta = {
        ...indexData.meta,
        domains: domainCount,
        feeds: feedCount,
};
const metaPath = path.join(outputDir, 'meta.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
