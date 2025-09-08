// vim: set ts=4 sw=4:

// Note: if you are reading this source code this is just a hacky crawler script
// Do not expect beautiful code here!

import { FeedUpdater } from './feedupdater.js';
import { Feed } from './feed.js';
import { linkAutoDiscover } from './parsers/autodiscover.js';
import robotsParser from '../node_modules/robots-parser/Robots.js';

import process from 'process';
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

async function run(indexFile = "../index.json", offset = 0, count = 1000000) {
    const start = offset;
    let result = {
        meta: {
            generated: Math.floor(new Date().getTime() / 1000),
            // saving the loop offset ensures the crawler can be restarted
            offset,
            count
        },
        domains: {}
    };

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
        if (i % 50 == 0) {
            result.meta.offset = i;
            fs.writeFileSync(indexFile, JSON.stringify(result, null, 2));
        }

        // stop after meta.count domains
        if (i >= start + result.meta.count) {
            console.log(`Reached crawl count of ${result.meta.count} domains.`);
            break;
        }
    }

    console.log("Crawling completed.");
}

const args = process.argv.slice(2);
if (args.length > 1) {
    if (args[0] === '--test') {
        processDomain(args[1]).then(feeds => {
            console.log(`Feeds discovered for ${args[1]}:`, feeds);
        }).catch(err => {
            console.error(`Error processing domain ${args[1]}:`, err);
        });
    }

    if (args[0] === '--parallel') {
        if (args.length < 4) {
            console.error("Usage: node crawler.js --parallel <worker nr> <offset> <count>");
            process.exit(1);
        } else {
            run(`../index${args[1]}.json`, parseInt(args[2]), parseInt(args[3]));
        }
    }
} else {
    run();
}
