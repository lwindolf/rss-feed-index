#!/usr/bin/env node

const result = {
    blogrolls: {}
}

// Extract all OPML links
fetch('https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/refs/heads/master/README.md')
    .then(response => response.text())
    .then(text => {
        const opmlLinks = text.match(/https?:\/\/\S+with_category\S+[^\s]+\.opml/g);
        if (!opmlLinks) {
            console.warn('No OPML links found in the README.md');
            return;        
        } 
        opmlLinks.forEach(link => {
            const title = "awesomerss: " + decodeURIComponent(link.match(/with_category\/(.*)\.opml/)[1]);
            result.blogrolls[link] = {
                t: title,
                u: "https://github.com/plenaryapp/awesome-rss-feeds/tree/master"
            };
        });

        console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error(`Error: ${error.message}`);
    });

