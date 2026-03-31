# ObserveOps

**Production-Grade SRE Observability Platform for Financial Services**

[![Security Scanning](https://img.shields.io/badge/security-6%20layers-green)](https://github.com/AkingbadeOmosebi/ObserveOps)
[![Infrastructure](https://img.shields.io/badge/IaC-Terraform-7B42BC)](https://github.com/AkingbadeOmosebi/ObserveOps)
[![Kubernetes](https://img.shields.io/badge/K8s-EKS-326CE5)](https://github.com/AkingbadeOmosebi/ObserveOps)
[![CI/CD](https://img.shields.io/badge/GitOps-GitHub%20Actions-2088FF)](https://github.com/AkingbadeOmosebi/ObserveOps)

A complete observability platform demonstrating production SRE practices for high-stakes financial environments. Built with security-first architecture, comprehensive monitoring, and automated incident response.

---

## 🎯 Project Overview

ObserveOps is a full-stack observability platform showcasing enterprise-grade Site Reliability Engineering practices. The system implements the three pillars of observability (logs, metrics, traces) with automated alerting, security scanning, and infrastructure as code - specifically designed for fintech/banking reliability requirements.

**Business Context:** Payment processing system with real-time monitoring, anomaly detection, and automated incident notifications.

---

## 🏗️ Architecture
   
   ![ObserveOps Architecture](docs/architecture/observeops-architecture.png)
   
   *Production-grade observability platform on AWS EKS with VPC isolation, OIDC federation, and comprehensive monitoring*
```

---

## ✨ Key Features

### 🔍 **Complete Observability**
- **Metrics Collection:** Prometheus scraping custom business KPIs (transfer success rates, active sessions, request latency)
- **Log Aggregation:** Centralized logging with Fluent Bit → Elasticsearch → Kibana dashboards
- **Distributed Tracing:** OpenTelemetry instrumentation with Jaeger backend
- **Real-time Alerting:** Email notifications for critical failures (< 1 minute detection)

### 🛡️ **Security-First Architecture**
- **6-Layer Scanning Pipeline:**
  - GitLeaks (secrets detection)
  - OWASP Dependency-Check (CVE scanning)
  - Trivy (container vulnerability scanning)
  - SonarCloud (code quality & security)
  - Snyk (dependency vulnerabilities)
  - Cosign (image signing & verification)
- **Zero-credential Storage:** OIDC federation with GitHub Actions
- **Encrypted Secrets:** Kubernetes secrets management with namespaced isolation

### ⚡ **Production Reliability**
- **High Availability:** Multi-AZ deployment with 2+ replicas per service
- **Auto-scaling:** Horizontal Pod Autoscaler (HPA) for traffic spikes
- **Self-healing:** Liveness/readiness probes with automatic pod restarts
- **Graceful Degradation:** Pod Disruption Budgets (PDB) for zero-downtime updates
- **Resource Guarantees:** CPU/memory requests and limits on all workloads

### 🚀 **DevOps & GitOps**
- **Infrastructure as Code:** Terraform for AWS EKS provisioning (100+ resources)
- **Declarative Configuration:** Kubernetes manifests with version control
- **Automated CI/CD:** GitHub Actions workflows with security gates
- **Container Registry:** GitHub Container Registry (GHCR) with automated builds

---

## 📊 Observability Stack Details

### **Prometheus + Grafana (Metrics)**
- Custom ServiceMonitor for backend metrics scraping
- Business KPI dashboards:
  - Payment transfer success/failure rates
  - Active user sessions
  - API request latency (p50, p95, p99)
  - Transfer amount distributions
- PromQL queries for real-time analysis

### **Fluent Bit + EFK (Logs)**
- Structured JSON logging from all services
- Centralized log collection via Fluent Bit DaemonSet
- Elasticsearch for log storage and indexing
- Kibana dashboards with pre-configured filters
- Log retention policies for compliance

### **Jaeger (Distributed Tracing)**
- OpenTelemetry SDK instrumentation in Node.js backend
- OTLP protocol for trace export
- Auto-instrumentation for Express, HTTP, Redis
- Service dependency mapping
- Trace sampling configuration

### **Alertmanager (Incident Response)**
- PrometheusRule for critical alert definitions:
  - `HighFailureRate`: > 0 failed transfers/sec
  - `PaymentAPIDown`: Service unavailable > 2 minutes
  - `HighRequestLatency`: p95 latency > 2 seconds
- Email notifications with severity-based routing
- Alert grouping and deduplication
- Repeat intervals: Critical (5min), Warning (15min)

---

## 🛠️ Technology Stack

**Infrastructure:**
- AWS EKS (Kubernetes 1.31)
- Terraform (IaC)
- AWS VPC, Subnets, NAT Gateway, Internet Gateway
- OIDC Provider for GitHub Actions

**Observability:**
- Prometheus Operator + Grafana
- Fluent Bit + Elasticsearch + Kibana
- Jaeger + OpenTelemetry
- Alertmanager

**Application:**
- Node.js (Express) backend
- React frontend
- Redis (session storage)
- Docker multi-stage builds

**Security & CI/CD:**
- GitHub Actions
- GitLeaks, OWASP, Trivy, SonarCloud, Snyk, Cosign
- GitHub Container Registry (GHCR)

---

## 📸 Screenshots

### **Infrastructure**

#### **AWS EKS Cluster**
![EKS Cluster Overview](docs/screenshots/observeops-eks-cluster.png)
*Production EKS cluster running in eu-central-1 with Kubernetes 1.31*

#### **EKS Node Groups**
![EKS Nodes](docs/screenshots/observeops-eks-cluster-nodes.png)
*Multi-AZ deployment with t3.medium instances across availability zones*

#### **EC2 Instances**
![EC2 Instances](docs/screenshots/eks-instances.png)
*Worker nodes running application and observability workloads*

---

### **Kubernetes Resources**

#### **Cluster Nodes**
![kubectl get nodes](docs/screenshots/kubectl-get-nodes.png)
*Healthy EKS nodes with Ready status*

#### **Application Pods**
![App Namespace Pods](docs/screenshots/kubectl-get-pods-namespace-app.png)
*Backend, frontend, and Redis pods running in app namespace*

#### **Observability Pods**
![Observability Namespace Pods](docs/screenshots/kubectl-get-pods-namespace-observability.png)
*Prometheus, Grafana, Alertmanager, Jaeger, and EFK stack running*

#### **Application Services**
![App Services](docs/screenshots/kubectl-get-svc-namespace-app.png)
*LoadBalancer and ClusterIP services exposing frontend and backend*

#### **Observability Services**
![Observability Services](docs/screenshots/kubectl-get-svc-namespace-observability.png)
*Monitoring and logging services with port configurations*

#### **PrometheusRule - Alert Definitions**
![PrometheusRule YAML](docs/screenshots/kubectl-get-prometheusrule-namespace-observability-payment-api-alerts.png)
*Custom alert rules for HighFailureRate, PaymentAPIDown, and HighRequestLatency*

---

### **Grafana - Metrics & Dashboards**

#### **Payment Transfers by Status**
![Transfer Status Dashboard](docs/screenshots/Grafana-transfer-status.png)
*Real-time visualization of successful vs failed payment transfers*

#### **Payment Volume & Transfer Metrics**
![Payments and Transfers](docs/screenshots/Grafana-payments-and-transfer.png)
*Business KPIs showing transfer rates, total volume, and transaction patterns*

#### **Active User Sessions**
![Payment Sessions](docs/screenshots/Grafana-payment-sessions.png)
*Live gauge showing active user sessions with authentication tracking*

**Key Metrics Tracked:**
- `payment_transfers_total{status="success|failed"}` - Transfer success/failure rates
- `payment_active_sessions` - Concurrent user sessions
- `http_request_duration_seconds` - API latency percentiles (p50, p95, p99)
- `payment_transfer_amount` - Distribution of transaction amounts

---

### **Kibana - Centralized Logging**

#### **Log Stream - All Services**
![Kibana Logs Overview](docs/screenshots/kibana-logs.png)
*Structured JSON logs from all pods with timestamp, method, path, and user agent*

## ��� Test Screenshot

![EKS Cluster](docs/screenshots/observeops-eks-cluster.png)
