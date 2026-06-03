#!/bin/sh
set -e

if [ -d /app/node_modules ]; then
  chown -R appuser:appgroup /app/node_modules
fi

exec gosu appuser "$@"
