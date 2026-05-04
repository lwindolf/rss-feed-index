// vim: set ts=4 sw=4:

// Note: if you are reading this source code this is just a hacky crawler script
// Do not expect beautiful code here!

import './init.js';
import './net.js';
import { Config } from './config.js';
import { Feed } from './feed.js';
import { FeedParser } from '../lzone-feed-parser/src/parser.js';
import { FeedUpdater } from './feedupdater.js';
import { linkAutoDiscover, opmlAutoDiscover, parserAutoDiscover } from '../lzone-feed-parser/src/autodiscover.js';
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

// Rate feeds in a Deleuzing way as belong to more or less minor communities
// those flags can be used as search filters
//
// Note: the order does not imply priority, it's just mapping. The mapping
// can always change so always read the mapping info from index.json
const minorBitMask = {
    fediverse : 1,      // blog owner has a fediverse account
    indieweb  : 2,      // micropub, webmention or other indieweb features detected
    mastodon  : 4,      // feed generator is mastodon
    friendica : 8,      // feed is on friendica
    wordpress : 16,     // feed generator is wordpress
    funkwhale : 32,     // feed is on funkwhale
    blogroll  : 64      // blog has a blogroll
};

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
    let minor = 0;

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

        let html = await fetch(url, {
            headers: {
                'User-Agent': Config.botName
            }
        });

        // Check first if URL is a feed link
        if(await parserAutoDiscover(html, url)) {
            console.log('-> Passed URL is a feed')
            links.push(url);
        } else {
            // Feed auto-discovery from HTML
            links = await linkAutoDiscover(html, url);
            console.log(`-> Discovered ${links.length} feed link(s):`, links);
            if (links.length > 3) {
                links = links.slice(0, 3);
                console.log(`-> Using only the first 3 links`);
            }
        }

        // Blogroll auto-discovery
        blogroll = await opmlAutoDiscover(html, url);
        if(blogroll) {
            console.log(`-> Discovered blogroll: ${blogroll}`);
            minor |= minorBitMask.blogroll;
        }

        // Minor discovery on HTML
        if (/<meta\s+name=["']fediverse:creator["']/.test(html))
            minor |= minorBitMask.fediverse;
        if (/<meta\s+name=["']generator["'][^>]+WordPress/.test(html))
            minor |= minorBitMask.wordpress;
        if (/<link\s+rel=["']webmention["']/.test(html) ||
            /<link\s+rel=["']micropub["']/.test(html))
            minor |= minorBitMask.indieweb;
        
        html = null;
    } catch (e) {
        console.error(`-> Error during link discovery for ${url}: ${e.message}`);
        console.error(e.stack);
    }

    for (let l of links) {
        if (Config.urlBlockRegex.test(l))
            continue;
        
        try {
            let f = await FeedUpdater.fetch(l);
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
                f.newItems = null;

                let result = {
                    n: f.title,
                    u: f.source,
                    f: f.type,
                    t: Math.floor(f.itemContentSize / f.itemCount),
                    c: Math.floor(f.mostRecentItemTime),
                    d: Math.floor(new Date().getTime() / 1000)
                };

                // Add optional stuff
                if (f.description)
                    result.i = f.description;
                if (f.audio)
                    result.m = 1;
                if (f.video)
                    result.m = result.m?result.m + 2 : 2;
                if (minor != 0)
                    result.M = minor;
                if (f.ns?.length > 0)
                    result.ns = f.ns;

                feeds.push(result);
                console.info(`-> Found feed: ${result.u}`);
            } else {
                console.warn(`-> Failed to fetch feed ${l}: error ${f.error}`);
            }
            f = null;
        } catch (e) {
            console.error(`-> Failed to fetch feed ${l}: exception ${e.message}`);
        }
    }
    return { feeds, blogroll };
}

function saveIndex(indexFile, result) {
    fs.writeFileSync(indexFile, JSON.stringify(result, null, 2));
}

function saveStatus(result) {
    fs.writeFileSync("status.json", JSON.stringify({
        meta: {
            name    : "RSS Feed Crawler",
            favicon : "https://lwindolf.github.io/rss-feed-index/feed.svg",
            links   : {
                "Website" : "https://lwindolf.github.io/rss-feed-index",
                "Source"  : "https://github.com/lwindolf/rss-feed-index"
            },
        },
        data: {
            offset    : result.meta.offset,
            urls      : Object.keys(result.urls).length,
            blogrolls : Object.keys(result.blogrolls).length
            // FIXME: new added feeds (not yet parsed)
            // FIXME: new added blogrolls (not yet parsed)
            // FIXME: memory usage
        },
        schedule: {
            running    : (result.meta.complete != true),
            started    : result.meta.generated,
            lastUpdate : Math.ceil(new Date().getTime() / 1000),
            refresh    : 5*60,      // fetch status every 5min
            maxAge     : 15*60      // if running != true and no change for 15min -> job is dead
        }
    }, null, 2));
}

function getNonEmptyElement(root, selector) {
    const element = root.querySelector(selector);
    return element && element.textContent.trim() !== '' ? element.textContent.trim() : null;
}

const parser = new DOMParser();

// Parse OPML blogroll data into summary info
function parseOPML(blogrollData) {
    const xmlDoc = parser.parseFromString(blogrollData, "application/xml");
    const parseError = xmlDoc.querySelector("parsererror");
    if (!parseError) {
        const root = xmlDoc.documentElement;
        const outlineCount = (blogrollData.match(/<outline/g) || []).length;
        return {
            title       : getNonEmptyElement(root, 'head > title'),
            ownerName   : getNonEmptyElement(root, 'head > ownerName'),
            ownerId     : getNonEmptyElement(root, 'head > ownerId'),
            lastUpdated : getNonEmptyElement(root, 'head > dateModified'),
            outlineCount
        };
    } else {
        throw new Error("OPML parsing error:", parseError.textContent);
    }
}

// Fetch and parse new/outdated blogroll
//
// Optional argument details allows for overriding certain properties
async function updateBlogroll(result, blogroll, details = {}) {
    const now = Math.floor(new Date().getTime() / 1000);

    if(!blogroll)
        return;

    console.log(`Checking blogroll:`, blogroll);
    if(!result.blogrolls[blogroll]?.d || (result.blogrolls[blogroll].d + 30 * 24 * 60 * 60 < now)) {
        console.log(`-> Outdated. Fetching...`);
        try {
            const opml = parseOPML(await fetch(blogroll, {
                headers: {
                    'User-Agent': Config.botName
                }
            }));
            if(opml.outlineCount > 0) {
                result.blogrolls[blogroll] = {
                    u: details?.u || opml.ownerId,
                    t: details?.t || opml.title,
                    o: opml.ownerName,
                    n: opml.outlineCount,
                    d: now
                };
            } else {
                throw new Error(`Empty OPML found.`);
            }
        } catch (e) {
            console.log("-> Error fetching blogroll!");
            result.blogrolls[blogroll] = {
                u: details?.u,
                t: details?.t,
                e: e.message,
                d: now
            };
        }

        console.log(result.blogrolls[blogroll]);
    } else {
        console.log(`-> Up-to-date. Skipping...`);
    }
}

// @urls        list of URLs to crawl (protocol can be missing, will default to https!) (or undefined when updating the index)
// @restart     boolean to indicate whether to restart the crawl (instead of continuing at last position)
async function run(indexFile = "index.json", urls, restart = false) {
    let result = {
        meta: {
            generated: Math.floor(new Date().getTime() / 1000),
            // saving the loop offset ensures the crawler can be restarted
            offset: 0,
            complete: false,
            minorBitMask
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

    result.meta.complete = false;
    if (restart)
        result.meta.offset = 0;
    if (!urls)
        urls = Object.keys(result.urls);
    if (!result.meta.minorBitMask)
        result.meta.minorBitMask = minorBitMask;

    // cleanup duplicates
    for (const u of Object.keys(result.urls)) {
        // Drop result.urls[i] if it starts with https:// and there is another result without
        // or rename it to just the domain. Also cover trailing slash.
        if (u.startsWith("https://")) {
            const replaced = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
            if (result.urls[replaced])
                delete result.urls[u];
            else
                result.urls[replaced] = result.urls[u];
        }
        // FIXME: handle www subdomains with identical result as domain
    }

    // loop over all URLs
    for (let i = result.meta.offset; i < urls.length; i++) {
        let url = urls[i];

        // strip https:// and trailing slash from URL (this happens if URL input comes from --add)
        url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

        result.meta.offset = i;

        // skip if already in index and recently updated
        if (result.urls[url]) {
            const diffDays = Math.floor((Math.floor(new Date().getTime() / 1000) - result.urls[url][0].d) / (60 * 60 * 24));
            if (diffDays < 30
                && result.urls[url][0].t
            ) { // update only if older than 30 days
                console.log(`Skipping ${i} ${url} - recently updated (${diffDays} days ago)`);
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
            console.log(`Skipping ${i} ${url} - exceeded max retries (${maxRedirects})`);
            continue;
        }

        console.log(`Processing #${i} / ${urls.length}: ${url} ...`);
        const { feeds, blogroll } = await processUrl(url.includes("://") ? url : `https://${url}`);
        if (feeds.length > 0)
            result.urls[url] = feeds;

        await updateBlogroll(result, blogroll);

        // save updated index
        delete result.processing[url];
        saveIndex(indexFile, result);
        saveStatus(result);
    }

    console.log("Crawling completed.");
    result.meta.complete = true;
    saveIndex(indexFile, result);
    saveStatus(result);
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
    } else if (args[0] === '--add') {
        if (args.length < 2) {
            console.error("Usage: node crawler.js --add <URL file>");
            process.exit(1);
        }
        run(`index.json`, fs.readFileSync(args[1], 'utf8').split('\n').filter(line => line.trim() !== ''), true /* restart */);
    } else if (args[0] === '--updateBlogrolls') {
        const sourceData = JSON.parse(fs.readFileSync(args[1], 'utf8'));
        const all = JSON.parse(execSync('datasets/opml-all.js', { encoding: 'utf-8' }));
        console.log(`Updating ${Object.keys(all.blogrolls).length} blogrolls...`);
        console.log(all);
        for (const [url, details] of Object.entries(all.blogrolls)) {
            await updateBlogroll(sourceData, url, details);
        }
        fs.writeFileSync(args[1], JSON.stringify(sourceData, null, 2));
    } else {
        console.error(`Unknown command. Usage:

    # Continuous mode (single thread)
    node crawler.js [--restart]

    # Testing a single URL
    node crawler.js --test <URL>

    # Adding URLs from text file
    node crawler.js --add <url file>

    # Merging two JSON files
    node crawler.js --merge <source JSON> <target JSON>

    # Update blogrolls from dataset sources
    node crawler.js --updateBlogrolls <index JSON>
    `);
        process.exit(1);
    }
} else {
    run('index.json', undefined, (args[0] === '--restart'));
}
