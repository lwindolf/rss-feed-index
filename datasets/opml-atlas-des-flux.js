#!/usr/bin/env node

const result = {
    blogrolls: {}
}

// Extract all OPML links
fetch('https://atlasflux.saynete.net/base_xml.htm')
    .then(response => response.text())
    .then(text => {
        const opmlLinks = text.match(/ href="([^"]+\.opml)"/g);
        if (!opmlLinks) {
            console.warn('No OPML links found!');
            return;        
        } 
        opmlLinks.forEach(line => {
            const link = line.match(/href="([^"]+)"/)[1];
            if (link) {
                result.blogrolls[`https://atlasflux.saynete.net/${link}`] = { u: 'https://atlasflux.saynete.net/' };
            }
        });

        console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
        console.error(`Error: ${error.message}`);
    });

