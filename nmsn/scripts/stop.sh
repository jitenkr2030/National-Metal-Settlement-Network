#!/bin/bash

echo "🛑 Stopping NMSN - National Metal Settlement Network"
echo "==================================================="

# Stop NMSN backend
if [ -f "pids/nmsn.pid" ]; then
    NMSN_PID=$(cat pids/nmsn.pid)
    if ps -p $NMSN_PID > /dev/null; then
        kill $NMSN_PID
        echo "✅ NMSN Backend stopped (PID: $NMSN_PID)"
    else
        echo "⚠️ NMSN Backend was not running"
    fi
    rm pids/nmsn.pid
else
    echo "⚠️ NMSN PID file not found"
fi

# Kill any remaining Node.js processes for NMSN
pkill -f "nmsn-backend" || true

echo "✅ All NMSN services stopped"
