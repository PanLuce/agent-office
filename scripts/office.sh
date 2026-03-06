#!/usr/bin/env bash
# Agent Office — shell integration
# Source this file in your .zshrc/.bashrc:
#   source /path/to/agent-office/scripts/office.sh

AGENT_OFFICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
AGENT_OFFICE_PORT="${AGENT_OFFICE_PORT:-7350}"
AGENT_OFFICE_PID_FILE="$AGENT_OFFICE_DIR/data/.server.pid"
AGENT_OFFICE_LOG="$AGENT_OFFICE_DIR/data/server.log"

_office_url() {
  echo "http://localhost:$AGENT_OFFICE_PORT"
}

_office_is_running() {
  if [ -f "$AGENT_OFFICE_PID_FILE" ]; then
    local pid
    pid=$(cat "$AGENT_OFFICE_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$AGENT_OFFICE_PID_FILE"
  fi

  # Fallback: check if port responds
  curl -s --max-time 2 "$(_office_url)/api/health" >/dev/null 2>&1
}

_office_format_uptime() {
  local s=$1
  if [ "$s" -ge 3600 ]; then
    printf "%dh %dm" $((s / 3600)) $(((s % 3600) / 60))
  elif [ "$s" -ge 60 ]; then
    printf "%dm %ds" $((s / 60)) $((s % 60))
  else
    printf "%ds" "$s"
  fi
}

_office_status_icon() {
  case "$1" in
    idle)      echo "  " ;;
    thinking)  echo "  " ;;
    coding)    echo "  " ;;
    reviewing) echo "  " ;;
    talking)   echo "  " ;;
    walking)   echo "  " ;;
    *)         echo "  " ;;
  esac
}

office() {
  local cmd="${1:-help}"
  shift 2>/dev/null

  case "$cmd" in
    start)
      if _office_is_running; then
        echo "Agent Office is already running on port $AGENT_OFFICE_PORT"
        return 0
      fi

      echo "Starting Agent Office..."
      mkdir -p "$AGENT_OFFICE_DIR/data"

      (cd "$AGENT_OFFICE_DIR" && node dist/server/server/index.js > "$AGENT_OFFICE_LOG" 2>&1 &
       echo $! > "$AGENT_OFFICE_PID_FILE")

      # Wait for server to be ready
      local attempts=0
      while [ $attempts -lt 20 ]; do
        if curl -s --max-time 1 "$(_office_url)/api/health" >/dev/null 2>&1; then
          echo "Agent Office running at $(_office_url)"
          return 0
        fi
        sleep 0.5
        attempts=$((attempts + 1))
      done

      echo "Failed to start. Check $AGENT_OFFICE_LOG"
      return 1
      ;;

    start-dev)
      if _office_is_running; then
        echo "Agent Office is already running on port $AGENT_OFFICE_PORT"
        return 0
      fi

      echo "Starting Agent Office in dev mode..."
      (cd "$AGENT_OFFICE_DIR" && npm run dev)
      ;;

    stop)
      if [ -f "$AGENT_OFFICE_PID_FILE" ]; then
        local pid
        pid=$(cat "$AGENT_OFFICE_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
          kill "$pid" 2>/dev/null
          echo "Agent Office stopped (PID $pid)"
        else
          echo "Process $pid not found"
        fi
        rm -f "$AGENT_OFFICE_PID_FILE"
      else
        echo "No PID file found. Checking port..."
        local pid
        pid=$(lsof -ti :"$AGENT_OFFICE_PORT" 2>/dev/null | head -1)
        if [ -n "$pid" ]; then
          kill "$pid" 2>/dev/null
          echo "Killed process $pid on port $AGENT_OFFICE_PORT"
        else
          echo "Agent Office is not running"
        fi
      fi
      ;;

    restart)
      office stop
      sleep 1
      office start
      ;;

    status)
      if ! _office_is_running; then
        echo "Agent Office is not running"
        return 1
      fi

      local response
      response=$(curl -s --max-time 3 "$(_office_url)/api/status")
      if [ -z "$response" ]; then
        echo "Agent Office is not responding"
        return 1
      fi

      local uptime working_dir active completed failed
      uptime=$(echo "$response" | jq -r '.uptime')
      working_dir=$(echo "$response" | jq -r '.workingDirectory // "none"')
      active=$(echo "$response" | jq -r '.activeTasks')
      completed=$(echo "$response" | jq -r '.completedTasks')
      failed=$(echo "$response" | jq -r '.failedTasks')

      echo ""
      echo "  Agent Office"
      echo "  ────────────────────────────────"
      echo "  URL:       $(_office_url)"
      echo "  Uptime:    $(_office_format_uptime "$uptime")"
      echo "  Project:   $working_dir"
      echo "  Tasks:     $active active, $completed done, $failed failed"
      echo ""

      echo "  Team"
      echo "  ────────────────────────────────"
      echo "$response" | jq -r '.agents[] | "  \(.role)\t\(.name)\t\(.status)"' | while IFS=$'\t' read -r role name status; do
        printf "  %-12s %-8s %s\n" "$role" "$name" "$status"
      done
      echo ""
      ;;

    open)
      if ! _office_is_running; then
        echo "Server not running, starting..."
        office start || return 1
      fi
      open "$(_office_url)" 2>/dev/null || xdg-open "$(_office_url)" 2>/dev/null || echo "Open $(_office_url) in your browser"
      ;;

    demo)
      if ! _office_is_running; then
        echo "Server not running, starting..."
        office start || return 1
      fi

      local result
      result=$(curl -s --max-time 3 "$(_office_url)/api/demo")
      local started
      started=$(echo "$result" | jq -r '.started')

      if [ "$started" = "true" ]; then
        echo "Demo started! Watch at $(_office_url)"
      else
        local error
        error=$(echo "$result" | jq -r '.error // "unknown error"')
        echo "Could not start demo: $error"
      fi
      ;;

    log | logs)
      if [ -f "$AGENT_OFFICE_LOG" ]; then
        tail -f "$AGENT_OFFICE_LOG"
      else
        echo "No log file found at $AGENT_OFFICE_LOG"
      fi
      ;;

    build)
      echo "Building Agent Office..."
      (cd "$AGENT_OFFICE_DIR" && npm run build)
      ;;

    test)
      (cd "$AGENT_OFFICE_DIR" && npm test)
      ;;

    help | *)
      echo ""
      echo "  Agent Office CLI"
      echo "  ────────────────────────────────"
      echo ""
      echo "  Server:"
      echo "    office start       Start the production server"
      echo "    office start-dev   Start in dev mode (with hot reload)"
      echo "    office stop        Stop the server"
      echo "    office restart     Restart the server"
      echo "    office status      Show server and agent status"
      echo "    office open        Open the browser UI"
      echo "    office log         Tail the server log"
      echo ""
      echo "  Project:"
      echo "    team-project PATH  Connect a project directory"
      echo "    ask-team TEXT      Send a task to the team"
      echo "    team-abort         Abort all running agents"
      echo "    team-status        Quick status check"
      echo ""
      echo "  Dev:"
      echo "    office build       Build the project"
      echo "    office test        Run the test suite"
      echo "    office demo        Run the demo animation"
      echo ""
      ;;
  esac
}

team-project() {
  local dir="${1:-.}"
  dir="$(cd "$dir" 2>/dev/null && pwd)"

  if [ ! -d "$dir" ]; then
    echo "Directory not found: $dir"
    return 1
  fi

  if ! _office_is_running; then
    echo "Agent Office is not running. Starting..."
    office start
    sleep 1
  fi

  local result
  result=$(curl -s --max-time 5 -X POST "$(_office_url)/api/start" \
    -H "Content-Type: application/json" \
    -d "{\"workingDirectory\": \"$dir\"}")

  local started
  started=$(echo "$result" | jq -r '.started')

  if [ "$started" = "true" ]; then
    echo "Connected to: $(basename "$dir")"
    echo "  Path: $dir"
    echo "  Send work: ask-team \"your task description\""
  else
    echo "Failed to connect: $result"
    return 1
  fi
}

ask-team() {
  local text="$*"

  if [ -z "$text" ]; then
    echo "Usage: ask-team <task description>"
    echo "  Example: ask-team \"Add user authentication with JWT\""
    return 1
  fi

  if ! _office_is_running; then
    echo "Agent Office is not running. Start it first: office start"
    return 1
  fi

  # Check if a working directory is set
  local status_response
  status_response=$(curl -s --max-time 3 "$(_office_url)/api/agent-status")
  local working_dir
  working_dir=$(echo "$status_response" | jq -r '.workingDirectory // "null"')

  if [ "$working_dir" = "null" ]; then
    echo "No project connected. Run: team-project /path/to/project"
    return 1
  fi

  local result
  result=$(curl -s --max-time 5 -X POST "$(_office_url)/api/command" \
    -H "Content-Type: application/json" \
    -d "{\"text\": $(echo "$text" | jq -Rs .)}")

  local received
  received=$(echo "$result" | jq -r '.received // false')

  if [ "$received" = "true" ]; then
    echo "Task sent to the team: \"$text\""
    echo "  Watch progress: office status"
    echo "  Browser view:   $(_office_url)"
  else
    local error
    error=$(echo "$result" | jq -r '.error // "unknown error"')
    echo "Failed: $error"
    return 1
  fi
}

team-abort() {
  if ! _office_is_running; then
    echo "Agent Office is not running"
    return 1
  fi

  local result
  result=$(curl -s --max-time 5 -X POST "$(_office_url)/api/abort" \
    -H "Content-Type: application/json")

  local count
  count=$(echo "$result" | jq -r '.count // 0')

  if [ "$count" -gt 0 ]; then
    echo "Aborted $count agent(s)"
  else
    echo "No agents were running"
  fi
}

team-status() {
  office status
}
