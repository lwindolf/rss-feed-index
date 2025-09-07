#!/bin/bash

set -euo pipefail

jq -c '[.domains[][] | { "key" : .u, "value": .n}] | from_entries' index.json >url-title.json

