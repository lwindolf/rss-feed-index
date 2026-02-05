#!/usr/bin/env node

// Uses the rss-finder fediverse server list to list users from 
// each mastodon server and to provide a feed index
//
// Note: this does not work on all instances as e.g. mastodon.social
// requires login for the API endpoint

const server_list = await (await fetch("https://lwindolf.github.io/rss-finder/data/fediverse.json")).json();
const urls = {};
for (const server of server_list.data.nodes) {
        if (server.softwarename !== 'mastodon')
                continue;

        console.error(`Fetching users from ${server.domain}...`);

        try {
                // List users from each server
                const data = await (await fetch(`https://${server.domain}/api/v1/timelines/public?local=true&limit=100`)).json();
                if(!data) {
                        console.error(`Error fetching users from ${server.domain}`);
                        continue;
                } 

                if(!Array.isArray(data) || data.length === 0) {
                        console.error(`No timeline result found on ${server.domain}`);
                        continue;
                }

                for (const post of data) {
                        urls[post.account.url + '.rss'] = true;
                }

        } catch (error) {
                console.error(`Error fetching users from ${server.domain}:`, error);
        }

        console.error(`Users total now: ${Object.keys(urls).length}`);
}

console.log(Object.keys(urls).join('\n'));