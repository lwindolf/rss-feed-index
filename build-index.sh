#!/bin/bash

set -euo pipefail

test -d www/data || mkdir -p www/data
jq -c '[.domains[][] | { "key" : .u, "value": .n}] | from_entries' index.json >www/data/url-title.json

domainCount=$(jq '.domains | length' index.json)
feedCount=$(jq '.domains[] | length' index.json | awk '{s+=$1} END {print s}')
jq -c '.meta | .domains='$domainCount' | .feeds='$feedCount' | .' index.json >www/data/meta.json

