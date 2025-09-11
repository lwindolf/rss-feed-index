// vim: set ts=4 sw=4:

// Feed Autodiscovery
//
// 1.) link discovery in HTML documents
// 2.) type discovery in feed documents (parser factory)

import { XPath } from './xpath.js';
import { AtomParser } from './atom.js';
import { RSSParser } from './rss.js';
import { RDFParser } from './rdf.js';
import { NamespaceParser } from './namespace.js';
import { JSDOM } from 'jsdom';
import { pfetch } from '../net.js';

var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;

// Return a parser class matching the given document string or undefined
function parserAutoDiscover(str) {
    let parsers = [AtomParser, RSSParser, RDFParser];
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(str, 'application/xml');
    let root = NamespaceParser.getRootNode(doc);

    for (let i = 0; i < parsers.length; i++) {
        for (let j = 0; j < parsers[i].autoDiscover.length; j++) {
            try {
                //console.info(`-> trying ${parsers[i].name} with ${parsers[i].autoDiscover[j]}`);
                if (XPath.lookup(root, parsers[i].autoDiscover[j]))
                    return parsers[i];
            } catch(e) {
                // ignore
            }
        }
    }
    return undefined;
}

// for a given HTML document link return all feed links found
async function linkAutoDiscover(url, baseURL = url) {
    let doc;
    const str = await pfetch(url);

    // Skip adult sites (https://developers.google.com/search/docs/specialty/explicit/guidelines)
    if (str.includes("RTA-5042-1996-1400-1577-RTA") ||
        str.match(/meta[^>]+content=["'][^"']*adult[^"']*["']/i)) {
        console.info("Link discovery: skipping adult site");
        return [];
    }

    // Try to parse as HTML
    try {
        doc = new window.DOMParser().parseFromString(str, 'text/html');
    } catch(e) {
        console.info("Link discovery: could not parse HTML!", e);
    }

    if (!doc)
        return [];

    let results = [];

    // Try DOM based extraction (this fails on unclosed <link> tags)
    doc.head.querySelectorAll('link[rel="alternate"]').forEach((n) => {
        const type = n.getAttribute('type');
        if (!type)
                return
        if ((type === 'application/atom+xml') ||
            (type === 'application/rss+xml') ||
            (type === 'application/rdf+xml') ||
            (type === 'text/xml'))
            results.push(n.getAttribute('href'));
    });

    // Fuzzy extract link tags from HTML string
    if(results.length === 0) {
        const linkPattern = /<link[^>]*>/g;
        const hrefPattern = /href="([^"]*)"/;
        const relPattern = /rel=["']alternate["']/;
        const typePattern = /type=["']([^"']+)["']/;

        let max = 100; // avoid excessive links
        let match;
        while (max && (match = linkPattern.exec(str)) !== null) {
            const relMatch = relPattern.exec(match[0]);
            const hrefMatch = hrefPattern.exec(match[0]);
            const typeMatch = typePattern.exec(match[0]);
            const type = typeMatch ? typeMatch[1] : null;
            const url = hrefMatch ? hrefMatch[1] : null;

            if (url && type && relMatch)
                    if ((type === 'application/atom+xml') ||
                        (type === 'application/rss+xml') ||
                        (type === 'application/rdf+xml') ||
                        (type === 'text/xml'))
                            results.push(url);
            max--;
        }
    }

    results = results.map((href) => {
        if (!href.includes("://")) {
            var u = new URL(baseURL);
            if (href.startsWith('/'))
                u.pathname = href;
            else
                u.pathname += "/" + href;
            return u.href;
        } else {
            return href;
        }
    });

    return results;
}

export { parserAutoDiscover, linkAutoDiscover };