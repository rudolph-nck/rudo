#!/usr/bin/env sh
# Starts the Procedure Runner team server (macOS / Linux).
cd "$(dirname "$0")" && exec python3 server.py "$@"
