#!/bin/bash
# Start Penpot MCP Server
# MCP HTTP: http://localhost:4401/mcp
# MCP WS:   ws://localhost:4402
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$SCRIPT_DIR/penpot-mcp/mcp" ]; then
  echo "MCP server not set up. Run setup-mcp.sh first."
  exit 1
fi

echo "Starting Penpot MCP Server..."
cd "$SCRIPT_DIR/penpot-mcp/mcp"
pnpm run bootstrap
