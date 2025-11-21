#!/bin/bash

echo "🚀 Starting CareForAll Platform..."
echo "📋 This will start all services including:"
echo "   - User Frontend (Port 8080)"
echo "   - Architecture Monitor (Port 3000)"  
echo "   - API Gateway (Port 8081)"
echo "   - All Backend Services"
echo "   - Observability Stack"
echo ""

echo "⏳ Building and starting all containers..."
docker-compose up --build

echo ""
echo "🎯 Access your applications:"
echo "   👥 User Platform: http://localhost:8080"
echo "   🔧 Architecture Monitor: http://localhost:3000" 
echo "   ⚙️  API Gateway: http://localhost:8081"
echo "   📊 Grafana: http://localhost:3000"
echo "   🔍 Jaeger: http://localhost:16686"
echo "   📈 Prometheus: http://localhost:9090"