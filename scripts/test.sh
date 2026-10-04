#!/bin/sh
# Runs the runtime tests from any directory.
cd "$(dirname "$0")/.." && node test/run.js "$@"
