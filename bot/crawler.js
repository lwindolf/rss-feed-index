// vim: set ts=4 sw=4:

// Note: if you are reading this source code this is just a hacky crawler script
// Do not expect beautiful code here!

import './init.js';
import './net.js';
import { Config } from './config.js';
import { Feed } from './feed.js';
import { FeedParser } from '../lzone-feed-parser/src/parser.js';
import { FeedUpdater } from './feedupdater.js';
import { linkAutoDiscover, opmlAutoDiscover } from '../lzone-feed-parser/src/autodiscover.js';
import robotsParser from '../node_modules/robots-parser/Robots.js';

import process from 'process';
import fs from 'fs';
import dns from 'dns';
import { execSync } from 'child_process';

process.on('uncaughtException', function (err) {
  console.log('Uncaught exception: ' + err);
  process.exit(1);
});

// Use Cloudflare family+adult filter resolver, so we do not 
// index adult or malicious site feeds
const resolver = new dns.Resolver();
resolver.setServers(['1.1.1.3']);

FeedParser.maxItems = 100;

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

async function processUrl(url) {
    let links = [];
    let feeds = [];
    let blogroll;

    try {
        const uri = new URL(url);
        const domain = uri.hostname;
        const origin = uri.origin;

        // DNS check
        const isResolvable = await checkDomain(domain);
        if (!isResolvable) {
            console.log(`-> Skipping ${domain} - not resolvable`);
            return { feeds: [], blogroll: null };
        }

        // robots.txt check
        try {
            const str = await fetch(`${origin}/robots.txt`, {
                headers: {
                    'User-Agent': Config.botName
                }
            });

            const robots = new robotsParser(`${origin}/robots.txt`, str);
            if (false === robots.isAllowed(url, Config.botName)) {
                console.log(`-> Skipping, because disallowed by robots.txt`);
                return { feeds: [], blogroll: null };
            }
        } catch (e) {
            // To be safe we only allow for HTTP 404 here, otherwise we skip this URL
            if (e.message.includes('HTTP Error: 404')) {
                console.log(`-> HTTP 404 on robots.txt, so proceeding...`);
            } else {
                console.error(`-> Error fetching robots.txt for ${origin}: ${e.message}, skipping site`);
                return { feeds: [], blogroll: null };
            }
        }

        // Feed auto-discovery
        const html = await fetch(url, {
            headers: {
                'User-Agent': Config.botName
            }
        });
        links = await linkAutoDiscover(html, url);
        console.log(`-> Discovered ${links.length} feed link(s):`, links);
        if (links.length > 3) {
            links = links.slice(0, 3);
            console.log(`-> Using only the first 3 links`);
        }

        // Blogroll auto-discovery
        blogroll = await opmlAutoDiscover(html, url);
        if(blogroll)
            console.log(`-> Discovered blogroll: ${blogroll}`);
    } catch (e) {
        console.error(`-> Error during link discovery for ${url}: ${e.message}`);
        console.error(e.stack);
    }

    for (let l of links) {
        if (l.includes('/comments/feed') ||
            l.includes('www.youtube.com') ||
	        l.includes('/wp-json/wp/v2/pages'))
            continue; // skip wordpress comment feeds and JSON
        
        try {
            const f = await FeedUpdater.fetch(l);
            if (Feed.ERROR_NONE == f.error && f.newItems && f.newItems.length > 0) {
                f.itemCount = 0;
                f.itemContentSize = 0;
                f.mostRecentItemTime = 0;
                f.audio = false;
                f.video = false;
                f.newItems?.forEach(item => {
                    f.itemCount++;
                    if (item.description)
                        f.itemContentSize += item.description.length;
                    if (item.time > f.mostRecentItemTime)
                        f.mostRecentItemTime = item.time;

                    item.media?.forEach(m => {
                        const type = m.mime || '';
                        if(type.startsWith('audio/'))
                            f.audio = true;
                        else if(type.startsWith('video/'))
                            f.video = true;
                    });
                });

                let result = {
                    n: f.title,
                    u: f.source,
                    f: f.type,
                    ns: f.ns,
                    t: Math.floor(f.itemContentSize / f.itemCount),
                    c: f.mostRecentItemTime,
                    d: Math.floor(new Date().getTime() / 1000)
                };

                // Add optional stuff
                if (f.description)
                    result.i = f.description;
                if (f.audio)
                    result.m = 1;
                if (f.video)
                    result.m = result.m?result.m + 2 : 2;

                feeds.push(result);
                console.info(`-> Found feed: ${f.source}`);
            } else {
                console.warn(`-> Failed to fetch feed ${l}: error ${f.error}`);
            }
        } catch (e) {
            console.error(`-> Failed to fetch feed ${l}: exception ${e.message}`);
        }
    }
    return { feeds, blogroll };
}

function saveIndex(indexFile, result) {
    fs.writeFileSync(indexFile, JSON.stringify(result, null, 2));
}

// @urls        list of URLs to crawl (protocol can be missing, will default to https!) (or undefined when updating the index)
// @restart     boolean to indicate whether to restart the crawl (instead of continuing at last position)
async function run(indexFile = "index.json", urls, offset = 0, count = 1000000, restart = false) {
    const start = offset;
    let oldResult;
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
        urls: {},
        blogrolls: {}
    };

    // load existing index if it exists
    if (fs.existsSync(indexFile)) {
        const data = fs.readFileSync(indexFile, 'utf8');
        result = JSON.parse(data);
    }

    if (restart)
        result.meta.offset = 0;
    if (!urls)
        urls = Object.keys(result.urls);

    // additionally load main index (if this is a parallel run) this is needed for comparing with old results
    if (indexFile !== "index.json" && fs.existsSync("index.json")) {
        const data = fs.readFileSync("index.json", 'utf8');
        oldResult = JSON.parse(data);
    } else {
        oldResult = result;
    }

    // loop over all URLs
    for (let i = result.meta.offset; i < urls.length; i++) {
        let url = urls[i];
        
        // stop after meta.count URLs
        if (i >= start + result.meta.count) {
            console.log(`Reached crawl count of ${result.meta.count} URLs.`);
            break;
        }

        result.meta.offset = i;

        // skip if already in index and recently updated
        if (oldResult.urls[url] &&
            oldResult.urls[url].length > 0) {
            const diffDays = Math.floor((Math.floor(new Date().getTime() / 1000) - oldResult.urls[url][0].d) / (60 * 60 * 24));
            if (diffDays < 30
                && oldResult.urls[url][0].t
            ) { // update only if older than 30 days
                console.log(`Skipping ${url} - recently updated (${diffDays} days ago)`);
                continue;
            }
        }

        // Retry recovery mechanism
        const maxRedirects = 3;
        if (!result.processing[url])
            result.processing[url] = { try: 1 };
        else
            result.processing[url].try = (result.processing[url].try || 0) + 1;

        saveIndex(indexFile, result);

        if (result.processing[url].try > maxRedirects) {
            delete result.processing[url];
            console.log(`Skipping ${url} - exceeded max retries (${maxRedirects})`);
            continue;
        }

        console.log(`Processing #${i} / ${urls.length}: ${url} ...`);
        const { feeds, blogroll } = await processUrl(url.includes("://") ? url : `https://${url}`);
        if (feeds.length > 0)
            result.urls[url] = feeds;
        if (blogroll)
            result.blogrolls[blogroll] = url;
        else
            delete result.blogrolls[blogroll];

        // save updated index
        delete result.processing[url];
        saveIndex(indexFile, result);
    }

    console.log("Crawling completed.");
    result.meta.complete = true;
    saveIndex(indexFile, result);
}

const args = process.argv.slice(2);
if (args.length > 1) {
    if (args[0] === '--test') {
        processUrl(args[1]).then(feeds => {
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
        targetData.blogrolls = { ...targetData.blogrolls, ...sourceData.blogrolls };
        targetData.meta.generated = Math.max(sourceData.meta.generated, targetData.meta.generated)
        targetData.meta.offset = Math.max(sourceData.meta.offset, targetData.meta.offset);

        // Save merged target data
        fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2));
        console.log(`Merged ${sourceFile} into ${targetFile}.`);
    } else if (args[0] === '--parallel') {
        if (args.length < 4) {
            console.error("Usage: node crawler.js --parallel <URL file> <worker nr> <offset> <count>");
            process.exit(1);
        }
        run(`index${args[2]}.json`, fs.readFileSync(args[1], 'utf8').split('\n'), parseInt(args[3]), parseInt(args[4]));
    } else if (args[0] === '--add') {
        if (args.length < 2) {
            console.error("Usage: node crawler.js --add <URL file>");
            process.exit(1);
        }
        run(`index.json`, fs.readFileSync(args[1], 'utf8').split('\n'), 0, 100000, true /* restart */);
    } else if (args[0] === '--updateBlogrolls') {
        const sourceData = JSON.parse(fs.readFileSync(args[1], 'utf8'));
        const blogrolls = JSON.parse(execSync('datasets/opml-all.js', { encoding: 'utf-8' }));
        sourceData.blogrolls = blogrolls;
        fs.writeFileSync(args[1], JSON.stringify(sourceData, null, 2));
    } else {
        console.error(`Unknown command. Usage:

    # Continuous mode (single thread)
    node crawler.js [--restart]

    # Testing a single URL
    node crawler.js --test <URL>

    # Adding URLs from text file (single thread)
    node crawler.js --add <url file>

    # Running in parallel
    node crawler.js --parallel <url file> <worker nr> <offset> <count>

    # Merging two JSON files
    node crawler.js --merge <source JSON> <target JSON>

    # Update blogrolls
    node crawler.js --updateBlogrolls <index JSON>
    `);
        process.exit(1);
    }
} else {
    run('index.json', undefined, 0, 100000, (args[0] === '--restart'));
}
