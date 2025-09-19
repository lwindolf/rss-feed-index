#!/bin/bash

set -euo pipefail

wget -q https://downloads.marginalia.nu/exports/feeds.csv -O - | cut -d, -f1 | sed 's/\"//g'