#!/bin/bash
# Start Penpot (Docker containers)
# Penpot will be at http://localhost:9001
echo "Starting Penpot..."
cd "$(dirname "$0")"
docker compose -p penpot -f docker-compose.yaml up -d
echo ""
echo "Penpot is starting up. It may take a minute on first run."
echo "Open http://localhost:9001 in your browser."
echo "Create an account, then create a design file."
