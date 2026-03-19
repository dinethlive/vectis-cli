# Penpot + MCP Server Setup

Everything needed to run a local Penpot instance with the MCP server that Vectis CLI connects to.

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Docker](https://www.docker.com/) + Docker Compose | Run Penpot containers |
| [pnpm](https://pnpm.io/) | Install MCP server dependencies |
| [Git](https://git-scm.com/) | Clone the Penpot MCP server |

## Quick Start

### 1. Start Penpot

```bash
cd docs/penpot-setup
bash start-penpot.sh
```

Wait ~1 minute on first run, then open http://localhost:9001.
Create an account and a design file.

### 2. Set Up MCP Server (first time only)

```bash
bash setup-mcp.sh
```

This clones the [Penpot repo](https://github.com/penpot/penpot) (shallow) and installs MCP server dependencies.

### 3. Start MCP Server

```bash
bash start-mcp.sh
```

### 4. Connect Plugin in Penpot

1. Open a design file in Penpot (http://localhost:9001)
2. Main menu → **Plugins**
3. Enter: `http://localhost:4400/manifest.json` → **Install**
4. Open the plugin panel
5. Click **"Connect to MCP server"**
6. **Keep the plugin panel open** (it bridges MCP ↔ Penpot)

### 5. Start Vectis CLI

```bash
cd ../..    # back to vectis-cli root
bun run dev
/doctor     # verify everything is connected
```

## Ports

| Port | Protocol | Service |
|------|----------|---------|
| 9001 | HTTP | Penpot UI |
| 1080 | HTTP | Mailcatcher (dev email viewer) |
| 4400 | HTTP | MCP Plugin server |
| 4401 | HTTP | MCP Streamable HTTP endpoint (`/mcp`) |
| 4402 | WebSocket | MCP live events |

## Stop Everything

```bash
# Stop Penpot containers
bash stop-penpot.sh

# Stop MCP server: Ctrl+C in its terminal
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yaml` | Penpot services (frontend, backend, postgres, valkey, exporter, mailcatcher) |
| `setup-mcp.sh` | Clone Penpot repo + install MCP dependencies (run once) |
| `start-mcp.sh` | Start MCP server (plugin + HTTP + WebSocket) |
| `start-penpot.sh` | Start Penpot Docker containers |
| `stop-penpot.sh` | Stop Penpot Docker containers |

## Troubleshooting

**Penpot won't start**: Make sure Docker is running. Check `docker compose -p penpot logs` for errors.

**MCP server errors**: Ensure `pnpm` is installed. Re-run `setup-mcp.sh` to reinstall dependencies.

**Plugin won't connect**: The plugin panel must stay open in Penpot. If it disconnects, close and reopen the plugin.

**`/doctor` fails in Vectis**: Check that both Penpot (port 9001) and MCP server (port 4401) are running.
