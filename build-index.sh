#!/bin/bash

set -euo pipefail

test -d www/data || mkdir -p www/data

# Extract all domains url/name tuples
# - Flatten the array of arrays
# - Filter out Wordpress wfw comment feeds
# - Strip https:// protocol from URLs
jq -c '[.domains[][] | select(.u and (.u | contains("/comments/feed") | not)) | { "key" : .u, "value": .n}] | from_entries' index.json >www/data/url-title.json
sed -i 's|https\?://||g' www/data/url-title.json

domainCount=$(jq '.domains | length' index.json)
feedCount=$(jq . www/data/url-title.json | wc -l)
jq -c '.meta | .domains='$domainCount' | .feeds='$feedCount' | .' index.json >www/data/meta.json

