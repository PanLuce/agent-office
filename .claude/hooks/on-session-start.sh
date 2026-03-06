#!/bin/bash
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SESSION_MARKER="/tmp/claude-session-$PPID"

# Ensure knowledge files exist
for f in ARCHITECTURE.md LEARNINGS.md HOWTO.md; do
  if [ ! -f "$PROJECT_ROOT/$f" ]; then
    echo "# ${f%.md}" > "$PROJECT_ROOT/$f"
  fi
done

# First message reminder only
if [ ! -f "$SESSION_MARKER" ]; then
  touch "$SESSION_MARKER"
  cat <<'EOF'
SESSION START - Read these project knowledge files:
- ARCHITECTURE.md: Read BEFORE planning any work
- LEARNINGS.md: Update when you discover something worth remembering
- HOWTO.md: Check when troubleshooting; update with new solutions
EOF
fi