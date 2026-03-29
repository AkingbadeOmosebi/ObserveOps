#!/bin/bash

set -e

echo "==== ObserveOps Teardown Script ===="

# Colors
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

read -p "Are you sure you want to destroy all resources? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Teardown cancelled."
  exit 0
fi

echo -e "${BLUE}Deleting Kubernetes resources...${NC}"
kubectl delete -f k8s/app/ --ignore-not-found=true
kubectl delete -f k8s/jaeger/ --ignore-not-found=true
kubectl delete -f k8s/efk/ --ignore-not-found=true
kubectl delete -f k8s/prometheus/ --ignore-not-found=true
kubectl delete -f k8s/namespaces/ --ignore-not-found=true

echo -e "${BLUE}Deleting Helm releases...${NC}"
helm uninstall prometheus -n monitoring --ignore-not-found=true

echo -e "${BLUE}Destroying Terraform infrastructure...${NC}"
cd terraform
terraform destroy -auto-approve
cd ..

echo -e "${RED}Teardown complete!${NC}"
