#!/bin/bash

echo "📊 NMSN Status Check"
echo "===================="

# Check NMSN backend
if [ -f "pids/nmsn.pid" ]; then
    NMSN_PID=$(cat pids/nmsn.pid)
    if ps -p $NMSN_PID > /dev/null; then
        echo "✅ NMSN Backend: Running (PID: $NMSN_PID)"
    else
        echo "❌ NMSN Backend: Not running (stale PID file)"
    fi
else
    echo "❌ NMSN Backend: Not running"
fi

# Check if port is listening
if netstat -tuln | grep -q ":3001 "; then
    echo "✅ Port 3001: Listening"
else
    echo "❌ Port 3001: Not listening"
fi

# Check logs
if [ -f "logs/nmsn-combined.log" ]; then
    LAST_LOG=$(tail -1 logs/nmsn-combined.log 2>/dev/null | cut -c1-50 || echo "No recent logs")
    echo "📋 Last log entry: $LAST_LOG..."
fi

echo ""
echo "🌐 Service URLs:"
echo "  • Health Check: http://localhost:3001/health"
echo "  • API Documentation: http://localhost:3001/api-docs"
echo ""

# Check system resources
echo "💻 System Resources:"
echo "  • Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "  • Load: $(uptime | awk -F'load average:' '{print $2}')"
