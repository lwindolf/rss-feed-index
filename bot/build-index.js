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
Object.entries(indexData.domains).forEach(([domain, feeds]) => {
        urlTitle[domain] = {};
        feeds.forEach((feed, i) => {
                if (i > 2)
                        return;
                if (feed.u.includes('/comments/feed'))
                        return;

                const name = (feed.n || '').trim();
                let url = feed.u.startsWith('https://') ? feed.u.slice(8) : feed.u; // Strip https://
                if (url.startsWith(domain))
                        url = url.slice(domain.length);

                urlTitle[domain][url] = name;
        });
});

// Write the url-title.json file
const urlTitlePath = path.join(outputDir, 'url-title.json');
fs.writeFileSync(urlTitlePath, JSON.stringify(urlTitle));

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
