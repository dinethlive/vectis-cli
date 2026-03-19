#!/bin/bash
# First-time setup for Penpot MCP Server
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$SCRIPT_DIR/penpot-mcp" ]; then
  echo "Cloning Penpot repo (contains MCP server)..."
  git clone --depth 1 https://github.com/penpot/penpot.git "$SCRIPT_DIR/penpot-mcp"
fi

echo "Installing MCP server dependencies..."
cd "$SCRIPT_DIR/penpot-mcp/mcp"

if [ -f "./scripts/setup" ]; then
  bash ./scripts/setup
else
  pnpm install
fi

echo ""
echo "Setup complete. Run start-mcp.sh to start the server."
