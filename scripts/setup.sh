#!/bin/bash
# ObserveOps infrastructure deployment script
# Provisions Terraform-managed AWS resources and deploys observability stack

set -e

echo "==== ObserveOps Setup Script ===="

# Colors for output readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Initializing Terraform...${NC}"
cd terraform
terraform init
cd ..

echo -e "${BLUE}Step 2: Creating namespaces...${NC}"
kubectl apply -f k8s/namespaces/

echo -e "${BLUE}Step 3: Installing Prometheus Stack...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  -f k8s/prometheus/values.yaml \
  -n monitoring

echo -e "${BLUE}Step 4: Installing Elasticsearch...${NC}"
kubectl apply -f k8s/efk/elasticsearch.yaml

echo -e "${BLUE}Step 5: Installing Fluent Bit...${NC}"
kubectl apply -f k8s/efk/fluentbit.yaml

echo -e "${BLUE}Step 6: Installing Kibana...${NC}"
kubectl apply -f k8s/efk/kibana.yaml

echo -e "${BLUE}Step 7: Installing Jaeger...${NC}"
kubectl apply -f k8s/jaeger/jaeger-operator.yaml

echo -e "${BLUE}Step 8: Deploying services...${NC}"
kubectl apply -f k8s/app/

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Access your services:"
echo "  Grafana:  kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
echo "  Kibana:   kubectl port-forward -n logging svc/kibana 5601:5601"
echo "  Jaeger:   kubectl port-forward -n tracing svc/jaeger 16686:16686"
echo "  App:      kubectl port-forward -n app svc/app-service 3000:80"
