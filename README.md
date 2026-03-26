# ObserveOps

OpenTelemetry-based observability and monitoring for cloud applications.

## Architecture

This repository contains infrastructure and services for metrics, logs, and distributed tracing:

- **Metrics**: Prometheus + Grafana (kube-prometheus-stack)
- **Logs**: Elasticsearch + Fluent Bit + Kibana (EFK Stack)
- **Traces**: Jaeger distributed tracing
- **Services**: Node.js backend and React frontend with instrumentation

## Prerequisites

- AWS Account with appropriate permissions
- Terraform >= 1.0
- kubectl >= 1.20
- Docker for building container images
- AWS CLI configured

## Directory Structure

```
ObserveOps/
├── .github/workflows/          # CI/CD pipelines
├── terraform/                  # Infrastructure as Code (AWS EKS)
├── k8s/                       # Kubernetes manifests
├── app/                       # Application services
├── docs/                      # Architecture & documentation
├── scripts/                   # Utility scripts
├── .gitignore
└── README.md
```

## Quick Start

### 1. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 2. Configure kubectl

```bash
aws eks update-kubeconfig \
  --region us-east-1 \
  --name observeops-cluster
```

### 2.5 Configure Secrets

**Set Grafana Password:**
Edit `k8s/prometheus/values.yaml` line 20 and replace `CHANGEME_SET_STRONG_PASSWORD` with a strong password.

**Configure Email Alerts:**
```bash
# Copy the example secret
cp k8s/prometheus/alertmanager-email-secret.yaml.example \
   k8s/prometheus/alertmanager-email-secret.yaml

# Edit and replace REPLACE_WITH_YOUR_GMAIL_APP_PASSWORD with your Gmail app password
nano k8s/prometheus/alertmanager-email-secret.yaml

# Apply the secret
kubectl apply -f k8s/prometheus/alertmanager-email-secret.yaml
```

### 3. Deploy Observability Stack

```bash
kubectl apply -f k8s/namespaces/
kubectl apply -f k8s/prometheus/
kubectl apply -f k8s/efk/
kubectl apply -f k8s/jaeger/
```

### 4. Deploy Services

```bash
kubectl apply -f k8s/app/
```

## Accessing Services

- **Grafana**: `kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80`
- **Kibana**: `kubectl port-forward -n logging svc/kibana 5601:5601`
- **Jaeger UI**: `kubectl port-forward -n tracing svc/jaeger 16686:16686`
- **App**: `kubectl port-forward -n app svc/app-service 3000:3000`

## Configuration

See `terraform/terraform.tfvars` for Terraform variables and individual YAML files for Kubernetes service configurations.

## Documentation

- [Architecture Diagram](docs/architecture.png)
- [Screenshots](docs/screenshots/)

## Cleanup

To destroy all resources:

```bash
./scripts/teardown.sh
```

## License

MIT
