function loadMeta() {
        fetch('data/meta.json')
        .then(response => response.json())
        .then(data => {
                document.getElementById('stats').innerHTML = `
                        <div class='stat'>Crawler Run: ${new Date(1000*data.generated).toLocaleDateString()}</div>
                        <div class='stat'>Progress: ${Number((data.offset*100/1000000).toFixed(2))}%</div>
                        <div class='stat'>Domains: ${data.domains}</div>
                        <div class='stat'>Feeds: ${data.feeds}</div>
                `;
        });
}

function addLink(parent, domain, url, name) {
        // Index does not contain default prefix "https://" and identical domains to safe space
        if (url[0] === '/')
                url = domain + url;
        if (!url.includes('://'))
                url = 'https://' + url;

        parent.className = 'feed-entry';

        const d = document.createElement('a');
        d.className = 'domain';
        d.href = 'https://' + domain;
        d.target = '_blank';
        d.textContent = domain;
        parent.appendChild(d);

        const link = document.createElement('a');
        link.className = 'feed';
        link.href = url;
        link.target = '_blank';
        link.textContent = name? name : '[no title]';
        parent.appendChild(link);
}

function loadRandom() {
        fetch('data/url-title.json')
        .then(response => response.json())
        .then(data => {
                let list = Object.keys(data);
                const offset = Math.floor(Math.random() * (list.length - 100));
                list = list.slice(offset, offset + 100);

                const container = document.getElementById('search-results');
                container.innerHTML = '<h2>100 Random Feeds</h2>';
                list.forEach(domain => {
                        Object.entries(data[domain]).forEach(([url, name]) => {
                                const div = document.createElement('div');
                                addLink(div, domain, url, name);
                                container.appendChild(div);
                        });                        
                });
        });
}

let flatIndex;
function performSearch(event) {
        const query = event.target.value.toLowerCase();
        console.log(`Searching for ${query}`);
        fetch('data/url-title.json')
        .then(response => response.json())
        .then(data => {
                if(!flatIndex) {
                        // flatten the data structure to a list of {domain, url, name}
                        flatIndex = Object.keys(data).map(domain => {
                                return Object.entries(data[domain]).map(([url, name]) => {
                                        return { domain, url, name };
                                });
                        }).flat();
                }
                const list = flatIndex.filter(e =>
                        e.url.toLowerCase().includes(query) || 
                        e.name.toLowerCase().includes(query) ||
                        e.domain.toLowerCase().includes(query)
                );

                const container = document.getElementById('search-results');
                container.innerHTML = `<h2>Search Results (${list.length})</h2>`;

                list.slice(0, 100).forEach(k => {
                        const div = document.createElement('div');
                        addLink(div, k.domain, k.url, k.name);
                        container.appendChild(div);
                });

                if(query.length > 2) {
                        // Highlight search term in results
                        const results = document.querySelectorAll('.feed-entry a');
                        results.forEach(link => {
                                const regex = new RegExp(`(${query})`, 'gi');
                                const newContent = link.textContent.replace(regex, '<span class="highlight">$1</span>');
                                link.innerHTML = newContent;
                        });
                }

                if(list.length === 0)
                        container.innerHTML += '<p>No results found. Try a different search term.</p>';
                if(list.length == 100)
                        container.innerHTML += '<p>Showing first 100 results only. Please refine your search.</p>';
        });
}

loadMeta();
loadRandom();
document.getElementById('search').addEventListener('input', performSearch);
document.getElementById('search').focus();
