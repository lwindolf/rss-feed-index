#!/bin/bash


curl -sL https://bukmark.club/feed.xml | grep '<a href="' | sed 's/.*a href="//;s/".*//'
