#!/bin/bash
set -e

echo "🚀 ObserveOps Deployment Script"
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Configure kubectl
echo -e "${BLUE}Configuring kubectl...${NC}"
aws eks update-kubeconfig --name observeops-cluster --region eu-central-1

# 2. Verify connection
echo -e "${BLUE}Verifying cluster connection...${NC}"
kubectl get nodes

# 3. Add Helm repos
echo -e "${BLUE}Adding Helm repositories...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update

# 4. Create namespaces
echo -e "${BLUE}Creating namespaces...${NC}"
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace app --dry-run=client -o yaml | kubectl apply -f -

# 5. Install Prometheus/Grafana (METRICS)
echo -e "${BLUE}Installing Prometheus + Grafana (Metrics)...${NC}"
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -n observability \
  --set grafana.adminPassword=ObserveOps2026! \
  --wait

echo -e "${GREEN}✓ Metrics stack ready${NC}"

# 6. Deploy EFK Stack (LOGS)
echo -e "${BLUE}Deploying EFK stack (Logs)...${NC}"
echo -e "${YELLOW}  → Elasticsearch${NC}"
kubectl apply -f k8s/efk/elasticsearch.yaml

echo -e "${YELLOW}  → Waiting for Elasticsearch to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=elasticsearch -n observability --timeout=300s

echo -e "${YELLOW}  → Fluent Bit${NC}"
kubectl apply -f k8s/efk/fluentbit.yaml

echo -e "${YELLOW}  → Kibana${NC}"
kubectl apply -f k8s/efk/kibana.yaml

kubectl wait --for=condition=ready pod -l app=kibana -n observability --timeout=300s

echo -e "${GREEN}✓ Logging stack ready${NC}"

# 7. Install Jaeger (TRACES)
echo -e "${BLUE}Installing Jaeger (Traces)...${NC}"
helm upgrade --install jaeger jaegertracing/jaeger \
  -n observability \
  --set provisionDataStore.cassandra=false \
  --set allInOne.enabled=true \
  --set storage.type=memory \
  --wait

echo -e "${GREEN}✓ Tracing stack ready${NC}"

# 8. Deploy application
echo -e "${BLUE}Deploying ObserveOps application...${NC}"
kubectl apply -f k8s/app/

# 9. Wait for pods
echo -e "${BLUE}Waiting for application pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=backend -n app --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n app --timeout=300s

# 10. Get access URLs
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Three Pillars of Observability:${NC}"
echo ""

# METRICS - Grafana
echo -e "${YELLOW}1. METRICS (Prometheus + Grafana)${NC}"
GRAFANA_PORT=$(kubectl get svc prometheus-grafana -n observability -o jsonpath='{.spec.ports[0].port}')
kubectl port-forward -n observability svc/prometheus-grafana 3000:${GRAFANA_PORT} &
echo "   Grafana: http://localhost:3000"
echo "   Username: admin"
echo "   Password: ObserveOps2026!"
echo ""

# LOGS - Kibana
echo -e "${YELLOW}2. LOGS (EFK Stack - Kibana)${NC}"
KIBANA_PORT=$(kubectl get svc kibana -n observability -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "5601")
kubectl port-forward -n observability svc/kibana 5601:${KIBANA_PORT} &
echo "   Kibana: http://localhost:5601"
echo ""

# TRACES - Jaeger
echo -e "${YELLOW}3. TRACES (Jaeger)${NC}"
kubectl port-forward -n observability svc/jaeger-query 16686:16686 &
echo "   Jaeger: http://localhost:16686"
echo ""

# Application
echo -e "${YELLOW}APPLICATION${NC}"
FRONTEND_LB=$(kubectl get svc frontend -n app -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
if [ "$FRONTEND_LB" = "pending" ]; then
  kubectl port-forward -n app svc/frontend 8080:80 &
  echo "   Frontend: http://localhost:8080"
else
  echo "   Frontend: http://${FRONTEND_LB}"
fi
echo ""

echo -e "${BLUE}Useful Commands:${NC}"
echo "  kubectl get pods -n app"
echo "  kubectl get pods -n observability"
echo "  kubectl logs -f deployment/backend -n app"
echo "  kubectl logs -f deployment/fluent-bit -n observability"
echo ""

echo -e "${GREEN}Ready for testing and screenshots!${NC}"
