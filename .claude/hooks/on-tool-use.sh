#!/bin/bash
# Read JSON from stdin, extract tool info, append to hook events file
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
TIMESTAMP=$(date +%s)

# Extract file path if present
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // .command // "n/a"' | head -c 200)

mkdir -p ./data
echo "{\"tool\":\"$TOOL_NAME\",\"file\":\"$FILE_PATH\",\"timestamp\":$TIMESTAMP}" >> ./data/hook-events.jsonl