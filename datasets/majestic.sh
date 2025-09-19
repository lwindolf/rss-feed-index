#!/bin/bash

set -euo pipefail

wget -q https://downloads.majestic.com/majestic_million.csv -O - | cut -d, -f3 