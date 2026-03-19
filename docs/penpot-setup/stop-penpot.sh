#!/bin/bash
# Stop Penpot
echo "Stopping Penpot..."
cd "$(dirname "$0")"
docker compose -p penpot -f docker-compose.yaml down
echo "Penpot stopped."
