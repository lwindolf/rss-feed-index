import fs from 'fs';
import path from 'path';

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
let feedCount = 0;
let countByFeedType = {};
let countByNS = {};
let countByTLD = {};
let countByProtocol = { http: 0, https: 0, gopher: 0 };
let countByMedia = { audio: 0, video: 0 };
let urlTitle = {};
Object.entries(indexData.domains).forEach(([domain, feeds]) => {
        feeds.forEach((feed, i) => {
                // Skip outdated feeds
                if (feed.c && (Date.now()/1000 - feed.c) > 365*24*3600)
                        return;

                if (!urlTitle[domain])
                        urlTitle[domain] = [];
                // Statistic counting
                const tld = domain.split('.').slice(-1)[0];
                const protocol = feed.u.split(':')[0];
                countByProtocol[protocol] = (countByProtocol[protocol] || 0) + 1;
                countByTLD[tld] = (countByTLD[tld] || 0) + 1;
                countByFeedType[feed.f] = (countByFeedType[feed.f] || 0) + 1;
                countByMedia.audio += (feed.m && feed.m & 1) ? 1 : 0;
                countByMedia.video += (feed.m && feed.m & 2) ? 1 : 0;
                (feed.ns || []).forEach(ns => {
                        countByNS[ns] = (countByNS[ns] || 0) + 1;
                });

                if (i > 2)
                        return;
                if (feed.u.includes('/comments/feed'))
                        return;

                const name = (feed.n || '').trim();
                let url = feed.u.startsWith('https://') ? feed.u.slice(8) : feed.u; // Strip https://
                if (url.startsWith(domain))
                        url = url.slice(domain.length);

                urlTitle[domain].push({
                        u: url,
                        n: name,
                        m: feed.m?feed.m:undefined,                     // media present
                        t: (feed.t > 15*500)?true:undefined             // flag for long-text
                });
                feedCount++;
        });
});

// Write the url-title.json file
const urlTitlePath = path.join(outputDir, 'url-title.json');
fs.writeFileSync(urlTitlePath, JSON.stringify(urlTitle));

// Calculate domain and feed counts
const domainCount = Object.keys(indexData.domains).length;

// Update meta.json
const meta = {
        ...indexData.meta,
        domains: domainCount,
        feeds: feedCount,
        byFeedType: countByFeedType,
        byNS: countByNS,
        byTLD: countByTLD,
        byProtocol: countByProtocol,
        byMedia: countByMedia,
        lastUpdated: Math.floor(Date.now() / 1000)
};
const metaPath = path.join(outputDir, 'meta.json');
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
