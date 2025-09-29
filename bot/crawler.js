// vim: set ts=4 sw=4:

// Note: if you are reading this source code this is just a hacky crawler script
// Do not expect beautiful code here!

import { Config } from './config.js';
import { FeedUpdater } from './feedupdater.js';
import { Feed } from './feed.js';
import { linkAutoDiscover } from './parsers/autodiscover.js';
import { pfetch } from './net.js';
import robotsParser from '../node_modules/robots-parser/Robots.js';

import process from 'process';
import fs from 'fs';
import dns from 'dns';

process.on('uncaughtException', function (err) {
  console.log('Uncaught exception: ' + err);
  process.exit(1);
});

// Use Cloudflare family+adult filter resolver, so do not 
// find adult or malicious site feeds
const resolver = new dns.Resolver();
resolver.setServers(['1.1.1.3']);

const checkDomain = (domain) => {
    return new Promise((resolve) => {
        resolver.resolve(domain, (err, records) => {
            if (err) {
                resolve(false); // Domain is not resolvable
            } else {
                if (records && records.length == 1 && records[0] === '0.0.0.0') {
                    resolve(false); // Blocked by Cloudflare family filter
                } else {
                    resolve(true); // Domain is resolvable
                }
            }
        });
    });
};

async function processDomain(domain, rank = undefined) {
    const url = `https://${domain}`;
    var links = [];
    var feeds = [];

    try {
        // DNS check
        const isResolvable = await checkDomain(domain);
        if (!isResolvable) {
            console.log(`-> Skipping ${domain} - not resolvable`);
            return [];
        }

        // robots.txt check
        const str = await pfetch(`${url}/robots.txt`, {
            headers: {
                'User-Agent': Config.botName
            }
        });
        
        const robots = new robotsParser(`${url}/robots.txt`, str);
        if (false === robots.isAllowed(url, Config.botName)) {
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
        if (l.includes('/comments/feed'))
            continue; // skip wordpress comment feeds
        
        try {
            const f = await FeedUpdater.fetch(l);
            if (Feed.ERROR_NONE == f.error && f.itemCount > 0) {
                feeds.push({
                    n: f.title,
                    u: f.source,
                    i: f.description,
                    f: f.type,
                    ns: f.ns,
                    t: Math.floor(f.itemContentSize / f.itemCount),
                    c: f.mostRecentItemTime,
                    d: Math.floor(new Date().getTime() / 1000)
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

function saveIndex(indexFile, result) {
    fs.writeFileSync(indexFile, JSON.stringify(result, null, 2));
}

async function run(indexFile = "index.json", offset = 0, count = 1000000, domains) {
    const start = offset;
    let result = {
        meta: {
            generated: Math.floor(new Date().getTime() / 1000),
            // saving the loop offset ensures the crawler can be restarted
            offset,
            start,
            count,
            complete: false
        },
        processing: {},
        domains: {}
    };

    // load existing index if it exists
    if (fs.existsSync(indexFile)) {
        const data = fs.readFileSync(indexFile, 'utf8');
        result = JSON.parse(data);
    }

    // loop over all domains
    for (let i = result.meta.offset; i < domains.length; i++) {
        // stop after meta.count domains
        if (i >= start + result.meta.count) {
            console.log(`Reached crawl count of ${result.meta.count} domains.`);
            break;
        }

        // skip if already in index and recently updated
        if (result.domains[domains[i]] &&
            result.domains[domains[i]].length > 0) {
            const diffDays = Math.floor((Math.floor(new Date().getTime() / 1000) - result.domains[domains[i]][0].d) / (60 * 60 * 24));
            if (diffDays < 30 
                && result.domains[domains[i]][0].t
            ) { // update only if older than 30 days
                console.log(`Skipping ${domains[i]} - recently updated (${diffDays} days ago)`);
                continue;
            }
        }

        result.meta.offset = i;

        // Retry recovery mechanism
        const maxRedirects = 3;
        if (!result.processing[domains[i]])
            result.processing[domains[i]] = { try: 1 };
        else
            result.processing[domains[i]].try = (result.processing[domains[i]].try || 0) + 1;

        saveIndex(indexFile, result);

        if (result.processing[domains[i]].try > maxRedirects) {
            delete result.processing[domains[i]];
            console.log(`Skipping ${domains[i]} - exceeded max retries (${maxRedirects})`);
            continue;
        }

        console.log(`Processing #${i}: ${domains[i]} ...`);
        const feeds = await processDomain(domains[i], i);
        if (feeds.length > 0)
            result.domains[domains[i]] = feeds;

        // save updated index
        delete result.processing[domains[i]];
        saveIndex(indexFile, result);
    }

    console.log("Crawling completed.");
    result.meta.complete = true;
    saveIndex(indexFile, result);
}

const args = process.argv.slice(2);
if (args.length > 1) {
    if (args[0] === '--test') {
        processDomain(args[1]).then(feeds => {
            console.log(`Feeds discovered for ${args[1]}:`, feeds);
        }).catch(err => {
            console.error(`Error processing domain ${args[1]}:`, err);
        });
    } else if (args[0] === '--merge') {
        if (args.length < 3) {
            console.error("Usage: node crawler.js --merge <source JSON> <target JSON>");
            process.exit(1);
        }
        const sourceFile = args[1];
        const targetFile = args[2];
        if (!fs.existsSync(sourceFile)) {
            console.error(`Source file ${sourceFile} does not exist.`);
            process.exit(1);
        }
        if (!fs.existsSync(targetFile)) {
            console.error(`Target file ${targetFile} does not exist.`);
            process.exit(1);
        }
        const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
        const targetData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

        if (!sourceData.meta.complete) {
            console.error(`Source file ${sourceFile} is not marked as complete.`);
            process.exit(1);
        }
        
        // Merge domains
        for (const [domain, feeds] of Object.entries(sourceData.domains)) {
            targetData.domains[domain] = feeds;
        }

        targetData.meta.generated = Math.max(sourceData.meta.generated, targetData.meta.generated)
        targetData.meta.offset = Math.max(sourceData.meta.offset, targetData.meta.offset);

        // Save merged target data
        fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2));
        console.log(`Merged ${sourceFile} into ${targetFile}.`);
    } else if (args[0] === '--parallel') {
        const domains = fs.readFileSync('domains.txt', 'utf8').split('\n');
        if (args.length < 4) {
            console.error("Usage: node crawler.js --parallel <worker nr> <offset> <count>");
            process.exit(1);
        }
        run(`index${args[1]}.json`, parseInt(args[2]), parseInt(args[3]), domains);
    } else {
        console.error("Unknown command. Usage:");
        console.error("  node crawler.js");
        console.error("  node crawler.js --test <domain>");
        console.error("  node crawler.js --merge <source JSON> <target JSON>");
        console.error("  node crawler.js --parallel <worker nr> <offset> <count>");
        process.exit(1);
    }
} else {
    const domains = fs.readFileSync('domains.txt', 'utf8').split('\n');
    run('index.json', 0, domains.length, domains);
}
