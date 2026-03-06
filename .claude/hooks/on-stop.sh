#!/bin/bash
TIMESTAMP=$(date +%s)
mkdir -p ./data
echo "{\"event\":\"agent_stop\",\"timestamp\":$TIMESTAMP}" >> ./data/hook-events.jsonl