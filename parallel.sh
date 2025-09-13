#!/bin/bash

set -euo pipefail

parallel=${1-10}
batch=1000
pids=()
offset=$(jq .meta.offset index.json)

for i in $(seq 1 $parallel); do
	echo "Starting job $i ..."
	node bot/crawler.js --parallel $i $((offset + i*batch)) $batch >$i.log 2>&1 &
	pids[${i}]=$!
done

while true; do
	complete=0
	sleep 5
	clear

	echo "Waiting for all jobs to complete ..."
	printf "\nJob   | Remaining | Complete\n"
	printf -- "------+-----------+---------\n"

	for i in $(seq 1 $parallel); do
		printf "Job %s | %9s | %s\n" "$i" "$(jq '.meta.start + .meta.count - .meta.offset' index${i}.json 2>/dev/null)" "$(jq .meta.complete index${i}.json 2>/dev/null || echo false)"
		if ! jq -e '.meta.complete' index${i}.json >/dev/null; then
			# Check for crash and restart if necessary
			if ! kill -0 ${pids[$i]} 2>/dev/null; then
				echo "Job $i (PID ${pids[$i]}) seems to have crashed. Restarting..."
				start=$(jq .meta.start index${i}.json)
				count=$(jq .meta.count index${i}.json)
				node bot/crawler.js --parallel $i $start $count >$i.log 2>&1 &
				pids[${i}]=$!
			fi
		else
			complete=$((complete + 1))
		fi
	done

	if [ $complete -eq $parallel ]; then
		printf "\nAll jobs completed.\n"
		break
	fi
done

for i in $(seq 1 $parallel); do
	node bot/crawler.js --merge index${i}.json index.json && rm index${i}.json
done

echo "Done."
