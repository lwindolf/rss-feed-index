// vim: set ts=4 sw=4:

// Note: if you are reading this source code this is just a hacky crawler script
// Do not expect beautiful code here!

import { FeedUpdater } from './feedupdater.js';
import { Feed } from './feed.js';
import { linkAutoDiscover } from './parsers/autodiscover.js';
import robotsParser from '../node_modules/robots-parser/Robots.js';

import fs from 'fs';

async function processDomain(url, rank = undefined) {
    var links = [];
    var feeds = [];

    try {
        // robots.txt check
        let allowed = false;
        await fetch(`${url}/robots.txt`, {
            headers: {
                'User-Agent': 'rss-feed-index-bot/0.9'
            }
        }).then(response => {
            if (response.status == 200) {
                return response.text();
            } else {
                return null;
            }
        }).then(str => {
            if (str) {
                const robots = new robotsParser(`${url}/robots.txt`, str);
                allowed = robots.isAllowed(url, 'rss-feed-index-bot/0.9');
            }
        });

        if (allowed === false) {
            console.log(`-> Skipping disallowed by robots.txt`);
            return [];
        }

        // Feed auto-discovery
        links = await linkAutoDiscover(url);
        console.log(`-> Discovered ${links.length} feed(s):`, links);
    } catch (e) {
        console.error(`-> Error during link discovery for ${url}: ${e.message}`);
    }

    for (let l of links) {
        try {
            const f = await FeedUpdater.fetch(l);
            if (Feed.ERROR_NONE == f.error) {
                let avgItemChars = 0;
                f.items.forEach(item => {
                    // simple char counting (not HTML-stripped)
                    if (item.description)
                        avgItemChars += item.description.length;
                });
                avgItemChars /= f.items.length;

                feeds.push({
                    n: f.title,
                    u: f.source,
                    i: f.description,
                    f: f.type,
                    ns: f.ns,
                    t: Math.floor(avgItemChars),
                    d: Math.floor(new Date().getTime() / 1000),
                    r: rank,  // rank from majestic list
                });
                console.info(`-> Found feed: ${f.source}`);
            } else {
                console.warn(`-> Failed to fetch feed ${l}: error ${f.error}`);
            }
        } catch (e) {
            console.error(`-> Failed to fetch feed ${l}: error ${e.message}`);
        }
    }
    return feeds;
}

async function run() {
    let result = {
        meta: {
            generated: Math.floor(new Date().getTime() / 1000),
            // saving the loop offset ensures the crawler can be restarted
            offset: 0
        },
        domains: {}
    };

    const indexFile = "../index.json";

    // load existing index if it exists
    if (fs.existsSync(indexFile)) {
        const data = fs.readFileSync(indexFile, 'utf8');
        result = JSON.parse(data);
    }

    // load majestic top 1 million sites
    const majesticFile = "../majestic_million.csv";
    const majesticData = fs.readFileSync(majesticFile, 'utf8');
    const lines = majesticData.split('\n');
    const domains = lines.slice(1).map(line => line.split(',')[2]).filter(Boolean);

    // loop over all domains
    for (let i = result.meta.offset; i < domains.length; i++) {
        // skip if already in index and recently updated
        if (result.domains[domains[i]] &&
            result.domains[domains[i]].length > 0) {
            const diffDays = Math.floor((Math.floor(new Date().getTime() / 1000) - result.domains[domains[i]][0].d) / (60 * 60 * 24));
            if (diffDays < 30) { // update only if older than 30 days
                console.log(`Skipping ${domains[i]} - recently updated (${diffDays} days ago)`);
                continue;
            }
        }

        console.log(`Processing #${i}: ${domains[i]} ...`);
        const feeds = await processDomain(`https://${domains[i]}`, i);
        if (feeds.length > 0)
            result.domains[domains[i]] = feeds;

        // save updated index
        if (i % 10 == 0) {
            result.meta.offset = i;
            fs.writeFileSync(indexFile, JSON.stringify(result, null, 2));
        }
    }

    console.log("Crawling completed.");
}

// Check for command-line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
    processDomain(args[0]).then(feeds => {
        console.log(`Feeds discovered for ${args[0]}:`, feeds);
    }).catch(err => {
        console.error(`Error processing domain ${args[0]}:`, err);
    });
} else {
    run();
}
