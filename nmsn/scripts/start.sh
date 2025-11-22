#!/bin/bash

echo "🚀 Starting NMSN - National Metal Settlement Network"
echo "=================================================="

# Load environment variables
source backend/.env

# Start the backend server
echo "Starting NMSN API Server..."
cd backend
npm start &
NMSN_PID=$!

# Save PID
echo $NMSN_PID > ../pids/nmsn.pid

echo "✅ NMSN Backend started with PID: $NMSN_PID"
echo ""
echo "🌐 NMSN API Server: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/health"
echo "🏪 Merchant Dashboard: file://$(pwd)/../frontend/dashboard.html"
echo ""
echo "📋 Available Endpoints:"
echo "  • GET  /health - System health check"
echo "  • POST /api/payments/create - Create metal payment"
echo "  • POST /api/payments/{id}/confirm - Confirm payment"
echo "  • GET  /api/payments/{id}/status - Payment status"
echo "  • GET  /api/prices/metals - Current metal prices"
echo "  • GET  /api/analytics/network - Network statistics"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for the process
wait $NMSN_PID
