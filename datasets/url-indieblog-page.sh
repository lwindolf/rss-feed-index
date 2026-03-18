#!/bin/bash

curl -sL https://indieblog.page/export | jq -r ".[].homepage" | sort -u
