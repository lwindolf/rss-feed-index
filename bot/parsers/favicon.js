// vim: set ts=4 sw=4:

// Favicon discovery in feed homepages

// For now for simplicity NewsAgain 
// - does not download favicons, but only persists the discovered link. 
//   (caching could be done by web workers...)
// - does discovery of URLs only once
//
// For simplicity discovery is only done
//
// 1.) in the feed parsed
// 2.) on the homepage HTML of the feed
//
// HTML links are analyzed by quality of the links
//
// 1.) links guaranteeing certain sizes >128px
// 2.) links possibly pointing to good icons
// 3.) links poiting to smaller icons

import { XPath } from './xpath.js';
import { pfetch } from '../net.js';

class Favicon {
    static searches = [
        { type: "MS Tile",          order: 2, xpath: "/html/head/meta[@name='msapplication-TileImage']/@href" },
        { type: "Safari Mask",      order: 3, xpath: "/html/head/link[@rel='mask-icon']/@href" },
        { type: "large icon",       order: 0, xpath: "/html/head/link[@rel='icon' or @rel='shortcut icon'][@sizes='192x192' or @sizes='144x144' or @sizes='128x128']/@href" },
        { type: "small icon",       order: 5, xpath: "/html/head/link[@rel='icon' or @rel='shortcut icon'][@sizes]/@href" },
        { type: "favicon",          order: 8, xpath: "/html/head/link[@rel='icon' or @rel='shortcut icon' or @rel='SHORTCUT ICON'][not(@sizes)]/@href" },
        { type: "Apple touch",      order: 1, xpath: "/html/head/link[@rel='apple-touch-icon' or @rel='apple-touch-icon-precomposed'][@sizes='180x180' or @sizes='152x152' or @sizes='144x144' or @sizes='120x120']/@href" },
        { type: "Apple no size",    order: 6, xpath: "/html/head/link[@rel='apple-touch-icon' or @rel='apple-touch-icon-precomposed'][not(@sizes)]/@href" },
        { type: "Apple small",      order: 7, xpath: "/html/head/link[@rel='apple-touch-icon' or @rel='apple-touch-icon-precomposed'][@sizes]/@href" }
    ].sort((a, b) => (a.order - b.order));

    static async discover(url, corsProxyAllowed = false) {
        let result;

        try {
            // Parse HTML
            let doc = await pfetch(url, {}, corsProxyAllowed)
                .then((response) => response.text())
                .then((str) => {
                    return new DOMParser().parseFromString(str, 'text/html');
                });

            if(doc) {
                // DOCTYPE node is first child when parsing HTML5, we need to 
                // find the <html> root node in this case
                let root = doc.firstChild;
                while(root && root.nodeName.toUpperCase() !== 'HTML') {
                    root = root.nextSibling;
                }

                if(root) {
                    // Check all XPath search pattern
                    for(let i = 0; i < Favicon.searches.length; i++) {
                        result = XPath.lookup(root, Favicon.searches[i].xpath)
                        if(result)
                            break;
                    }
                }
            }
        // eslint-disable-next-line no-empty
        } catch { }

        // If nothing found see if there is a 'favicon.ico' on the homepage
        if(!result)
            result = await pfetch(url + '/favicon.ico', {}, corsProxyAllowed)
                .then((response) => response.text())
                .then(() => url + '/favicon.ico');

        if(result) {
            if(result.includes('://'))
                return result;
            else
                return url + '/' + result;
        }
    }
}

export { Favicon };