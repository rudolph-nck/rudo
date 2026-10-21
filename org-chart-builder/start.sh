#!/usr/bin/env sh
# Starts the Org Chart Builder team server (macOS / Linux).
cd "$(dirname "$0")" && exec python3 server.py "$@"
