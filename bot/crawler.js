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

import path from 'path';
import process from 'process';
import fs from 'fs';
import dns from 'dns';

const sleepIntervalMinutes = 15;
const indexUpdateIntervalDays = 30;
let shutdown = false;
let idleTimeoutId = null;

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
                if (records && records.length === 1 && records[0] === '0.0.0.0') {
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
                    t: f.itemCount?Math.floor(f.itemContentSize / f.itemCount) : 0,
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

function saveIndex(result, indexDir) {
    fs.writeFileSync(path.join(indexDir, "index.json"), JSON.stringify(result, null, 2));
}

function saveStatus(result, indexDir) {
    const refreshInterval = 5*60;
    const updateInterval = indexUpdateIntervalDays*24*60*60;

    fs.writeFileSync(path.join(indexDir, "status.json"), JSON.stringify({
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
            blogrolls : Object.keys(result.blogrolls).length,
            complete  : result.meta.complete
            // FIXME: new added feeds (not yet parsed)
            // FIXME: new added blogrolls (not yet parsed)
            // FIXME: memory usage
        },
        schedule: {
            lastUpdate : result.meta.generated,
            nextRun    : result.meta.generated + updateInterval,
            refresh    : refreshInterval, // how often the status should be refreshed (e.g. for frontend display)
            maxAge     : updateInterval
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
        throw new Error("OPML parsing error:" + parseError.textContent);
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
    if(!result.blogrolls[blogroll]?.d || (result.blogrolls[blogroll].d + indexUpdateIntervalDays * 24 * 60 * 60 < now)) {
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

// Load existing index or create a new one and return it
function getIndex(indexDir, restart) {
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
    if (fs.existsSync(path.join(indexDir, "index.json"))) {
        const data = fs.readFileSync(path.join(indexDir, "index.json"), 'utf8');
        result = JSON.parse(data);

        if (restart) {
            result.meta.complete = false;
            result.meta.offset = 0;
        }
    } else {
        saveIndex(result, indexDir);
    }

    return result;
}

async function run(result, indexDir) {
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
    const urls = Object.keys(result.urls);
    for (let i = result.meta.offset; i < urls.length; i++) {
        let url = urls[i];

        // strip https:// and trailing slash from URL (this happens if URL input comes from --add)
        url = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

        result.meta.offset = i;

        // skip if already in index and recently updated
        if (result.urls[url] &&
            result.urls[url][0] &&
            result.urls[url][0].d &&
            result.urls[url][0].t) {
            const diffDays = Math.floor((Math.floor(new Date().getTime() / 1000) - result.urls[url][0].d) / (60 * 60 * 24));
            if (diffDays < indexUpdateIntervalDays
                && result.urls[url][0].t
            ) { // update only if older than x days
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

        saveIndex(result, indexDir);

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
        saveIndex(result, indexDir);
        saveStatus(result, indexDir);

        // FIXME: periodically check for added feed URLs and blogrolls during crawl too

        if (shutdown)
            process.exit(0);
    }

    console.log("Crawling completed.");
    result.meta.complete = true;
    saveIndex(result, indexDir);
    saveStatus(result, indexDir);
}

async function processInputFiles(result, indexDir) {

    // Check for URLs lists (.txt files) in input directory
    try {
        const inputFiles = fs.readdirSync(path.join(indexDir, 'input')).filter(f => f.endsWith('.txt'));
        for (const file of inputFiles) {
            console.log(`Processing input file: ${file}`);
            const content = fs.readFileSync(path.join(indexDir, 'input', file), 'utf8');
            const urls = content.split('\n').filter(line => line.trim() !== '');

            for (const url of urls) {
                const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
                if (!result.urls[cleanUrl]) {
                    result.urls[cleanUrl] = [];
                    console.log(`Added new URL from input: ${cleanUrl}`);
                    processUrl(url).then(async ({ feeds, blogroll }) => {
                        result.urls[cleanUrl] = feeds;
                        await updateBlogroll(result, blogroll);
                    });
                } else {
                    console.log(`URL already exists in index: ${cleanUrl}`);
                }
            }

            fs.unlinkSync(path.join(indexDir, 'input', file));
            console.log(`Finished processing input file: ${file}`);
        }
        saveIndex(result, indexDir);
    } catch (e) {
        console.error(`Error processing input directory: ${e.message}`);
    }
}

// function to periodically start full crawls and continuosly add new content
//
// @indexDir    directory containing the index and input files
// @restart     boolean to indicate whether to restart the crawl (instead of continuing at last position)
async function continuousRun(indexDir, restart) {
    let result = getIndex(indexDir, restart);

    console.log("Starting continuous crawl")
    console.log("  indexDir =", indexDir);
    console.log("  restart =", restart);
    console.log("  offset =", result.meta.offset);
    console.log("  complete =", result.meta.complete);

    while (!shutdown) {
        const indexAgeInDays = Math.floor((Date.now() / 1000 - result.meta.generated) / (60 * 60 * 24));

        // Start a crawl if index is not fresh or complete
        if (indexAgeInDays >= indexUpdateIntervalDays) {          
            console.log("Index age is > update interval, setting restart flag");
            restart = true;
        }

        // On restart reset crawler state
        if (restart) {
            console.log("Restart requested, resetting state");
            result.meta.offset = 0;
            result.meta.complete = false;
            result.meta.generated = Math.floor(new Date().getTime() / 1000);
            saveIndex(result, indexDir);
            restart = false;
        }

        if (!result.meta.complete) {
            console.log("Index is not complete, starting...");
            await run(result, indexDir);
        } else {
            console.log(`Index is complete and fresh (age: ${indexAgeInDays} days). Next update in ${indexUpdateIntervalDays - indexAgeInDays} days`);
        }

        await processInputFiles(result, indexDir);

        console.log(`Sleeping for ${sleepIntervalMinutes}min`);
        await new Promise(resolve => {
            idleTimeoutId = setTimeout(resolve, sleepIntervalMinutes * 60 * 1000);
        });
    }
}

// poor man's not really race free shutdown
function shutdownCb(signal) {
    shutdown = true;

    if(idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        console.log(`Received ${signal}. Shutting down...`);
    } else {
        console.log(`Received ${signal}. Shutting down after next URL...`);
    }
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    console.error(`Usage:

    # Continuous mode (single thread)
    node crawler.js --run [--restart] [<index directory>]

    # Testing a single URL
    node crawler.js --test <URL>
    `);
    process.exit(1);
}

if (command === '--test') {
    const url = args[1];
    if (!url) {
        console.error('Error: --test requires a URL argument');
        process.exit(1);
    }
    processUrl(url).then(result => {
        console.log(`Feeds discovered for ${url}:`, result);
    }).catch(err => {
        console.error(`Error processing URL ${url}:`, err);
    });
} else if (command === '--run') {
    const restart = args.includes('--restart');
    const indexDir = args.find(arg => arg !== '--run' && arg !== '--restart') || 'index';
    continuousRun(indexDir, restart);
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}


process.on('SIGTERM', () => shutdownCb('SIGTERM'));
process.on('SIGINT', () => shutdownCb('SIGINT'));