#!/usr/bin/env bash
# Agent Office — installer
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$PROJECT_DIR/scripts"
OFFICE_SH="$SCRIPT_DIR/office.sh"
SOURCE_LINE="source \"$OFFICE_SH\""

echo ""
echo "  Agent Office Installer"
echo "  ========================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is required but not found."
  echo "  Install it from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  Node.js 18+ required, found v$(node -v)"
  exit 1
fi
echo "  Node.js $(node -v)"

if ! command -v jq >/dev/null 2>&1; then
  echo "  jq is required for shell integration."
  echo "  Install: brew install jq"
  exit 1
fi
echo "  jq $(jq --version)"

if ! command -v claude >/dev/null 2>&1; then
  echo "  Warning: Claude Code CLI not found. Agents won't work without it."
  echo "  Install: npm install -g @anthropic-ai/claude-code"
else
  echo "  Claude Code CLI found"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
(cd "$PROJECT_DIR" && npm install)
echo "  Dependencies installed"

# Ensure data directory
mkdir -p "$PROJECT_DIR/data"
echo "  Data directory ready"

# Make scripts executable
chmod +x "$OFFICE_SH"
chmod +x "$SCRIPT_DIR/install.sh"
if [ -d "$PROJECT_DIR/.claude/hooks" ]; then
  chmod +x "$PROJECT_DIR/.claude/hooks/"*.sh 2>/dev/null || true
fi
echo "  Scripts executable"

# Add to .zshrc if not already there
SHELL_RC="$HOME/.zshrc"
if [ -n "${BASH_VERSION:-}" ] && [ ! -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if grep -q "office.sh" "$SHELL_RC" 2>/dev/null; then
  echo "  Already in $SHELL_RC"
else
  echo "" >> "$SHELL_RC"
  echo "# Agent Office" >> "$SHELL_RC"
  echo "$SOURCE_LINE" >> "$SHELL_RC"
  echo "  Added to $SHELL_RC"
fi

# Build the project
echo ""
echo "Building project..."
(cd "$PROJECT_DIR" && npm run build)
echo "  Build complete"

echo ""
echo "  ========================================"
echo "  Agent Office installed successfully!"
echo "  ========================================"
echo ""
echo "  Open a NEW terminal, then:"
echo ""
echo "    office start          # Start the server"
echo "    office open           # Open in browser"
echo "    team-project .        # Connect to current project"
echo '    ask-team "Add auth"   # Send work to the team'
echo "    office status         # Check agent status"
echo "    office demo           # Watch the demo animation"
echo ""
