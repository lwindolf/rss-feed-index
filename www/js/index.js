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

function loadRandom() {
        fetch('data/url-title.json')
        .then(response => response.json())
        .then(data => {
                let list = Object.keys(data).map(k => {
                        return {
                                url: k,
                                name: data[k]
                        };
                });
                const offset = Math.floor(Math.random() * (list.length - 100));
                list = list.slice(offset, offset + 100);

                const container = document.getElementById('search-results');
                container.innerHTML = '<h2>100 Random Feeds</h2>';
                list.forEach(k => {
                        const div = document.createElement('div');
                        div.className = 'feed-entry';
                        div.innerHTML = `<a href="${k.url}" target="_blank">${k.name}</a>`;
                        container.appendChild(div);
                });
        });
}

function performSearch(event) {
        const query = event.target.value.toLowerCase();
        if (query.length < 3) {
                loadRandom();
                return;
        }
        console.log(`Searching for ${query}`);
        fetch('data/url-title.json')
        .then(response => response.json())
        .then(data => {
                let list = Object.keys(data).map(k => {
                        return {
                                url: k,
                                name: data[k]
                        };
                });
                list = list.filter(e => e.url.toLowerCase().includes(query) || (e.name && e.name.toLowerCase().includes(query)));

                const container = document.getElementById('search-results');
                container.innerHTML = `<h2>Search Results (${list.length})</h2>`;

                list = list.slice(0, 100);
                list.forEach(k => {
                        const div = document.createElement('div');
                        div.className = 'feed-entry';
                        div.innerHTML = `<a href="${k.url}" target="_blank">${k.name}</a>`;
                        container.appendChild(div);
                });

                // Highlight search term in results
                const results = document.querySelectorAll('.feed-entry a');
                results.forEach(link => {
                        const regex = new RegExp(`(${query})`, 'gi');
                        const newContent = link.textContent.replace(regex, '<span class="highlight">$1</span>');
                        link.innerHTML = newContent;
                });

                if(list.length === 0)
                        container.innerHTML += '<p>No results found. Try a different search term.</p>';
                if(list.length == 100)
                        container.innerHTML += '<p>Showing first 100 results only. Please refine your search.</p>';
        });
}

loadMeta();
loadRandom();
document.getElementById('search').addEventListener('input', performSearch);
