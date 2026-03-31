# 🔧 Challenges & Solutions

This document details real production challenges encountered while building ObserveOps, the systematic debugging process used to resolve them, and key lessons learned. These experiences demonstrate problem-solving methodology, incident response capabilities, and production Kubernetes/AWS expertise.

---

## Table of Contents

1. [Infrastructure Challenges](#infrastructure-challenges)
2. [Observability Configuration](#observability-configuration)
3. [CI/CD & Security](#cicd--security)
4. [Application Debugging](#application-debugging)
5. [Key Takeaways](#key-takeaways)

---

## Infrastructure Challenges

### Challenge 1: VPC Deletion Dependency Violations

**Problem:**
```bash
$ terraform destroy

Error: deleting EC2 Subnet (subnet-08492fb6e00c77a32): operation error EC2: DeleteSubnet, 
https response error StatusCode: 400, api error DependencyViolation: The subnet has 
dependencies and cannot be deleted.

Error: deleting EC2 Internet Gateway (igw-033725400394e99b4): detaching EC2 Internet 
Gateway from VPC: Network has some mapped public address(es). Please unmap those public 
address(es) before detaching the gateway.
```

**Root Cause:**
Kubernetes created a Classic LoadBalancer for the frontend service. When the EKS cluster was deleted, the LoadBalancer was removed, but AWS took 5-15 minutes to fully detach the Elastic Network Interfaces (ENIs) from the public subnets. Terraform attempted to delete subnets while ENIs were still in "detaching" state.

**Debugging Process:**
1. Listed network interfaces in VPC:
   ```bash
   aws ec2 describe-network-interfaces --region eu-central-1 \
     --filters "Name=vpc-id,Values=vpc-0ee9e392dc0319d44"
   
   # Found: eni-0149bf3dd95dc59c3 and eni-0f03c81894454b068
   # Description: ELB adf912954ea944bf6b18ea1d1b3091e7
   ```

2. Attempted manual ENI deletion:
   ```bash
   aws ec2 delete-network-interface --network-interface-id eni-0149bf3dd95dc59c3
   
   # Error: Network interface is currently in use
   ```

3. Checked LoadBalancer status:
   ```bash
   aws elb describe-load-balancers --region eu-central-1
   
   # Result: LoadBalancerDescriptions: []
   # LoadBalancer was already deleted, but ENIs were slow to detach
   ```

**Solution:**
1. Delete all Kubernetes resources first (especially LoadBalancer services):
   ```bash
   kubectl delete -f k8s/app/
   kubectl delete -f k8s/prometheus/
   kubectl delete -f k8s/efk/
   kubectl delete -f k8s/jaeger/
   kubectl delete namespace app observability
   ```

2. Wait 2-3 minutes for AWS to fully detach ENIs

3. Re-run Terraform destroy:
   ```bash
   terraform destroy -auto-approve
   ```

**Result:** VPC and all resources deleted successfully after 10-12 minutes.

**Lesson Learned:**
- Always delete Kubernetes LoadBalancer services before destroying VPC infrastructure
- AWS network interface detachment is asynchronous (can take 5-15 minutes)
- Create cleanup scripts that handle dependencies in correct order:
  1. K8s resources → 2. Wait → 3. Terraform destroy
- Consider using `depends_on` in Terraform for explicit cleanup ordering

---

### Challenge 2: NAT Gateway Cost Optimization

**Problem:**
Initial design used one NAT Gateway per private subnet (4 total for 2 AZs with redundancy), resulting in ~$150/month just for NAT Gateways ($0.045/hour × 4 × 730 hours).

**Analysis:**
- Each NAT Gateway costs $0.045/hour (~$32.85/month)
- Data processing: $0.045/GB
- Demo environment doesn't need 4-way redundancy

**Solution:**
Reduced to 2 NAT Gateways (one per AZ) for high availability without over-provisioning:
```hcl
resource "aws_nat_gateway" "main" {
  count         = 2  # One per AZ (was 4)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}
```

**Trade-offs:**
- **Cost:** Reduced from ~$150/month to ~$75/month (50% savings)
- **Availability:** Still multi-AZ (one NAT per AZ)
- **Risk:** Single NAT failure affects one AZ only (acceptable for demo)

**Lesson Learned:**
- Understand AWS pricing before deploying (NAT Gateways are expensive)
- Balance cost vs. availability based on environment (prod vs. demo)
- For production: Consider NAT instances or VPC endpoints for cost savings

---

## Observability Configuration

### Challenge 3: Prometheus Not Scraping Backend Metrics

**Problem:**
Grafana dashboards showed "No data" for all custom metrics despite backend `/metrics` endpoint working correctly.

**Debugging Process:**

1. **Verified backend /metrics endpoint:**
   ```bash
   kubectl port-forward -n app svc/backend 3001:3001
   curl localhost:3001/metrics
   
   # ✅ Output showed Prometheus metrics:
   # payment_transfers_total{status="success"} 42
   # payment_transfers_total{status="failed"} 3
   # http_request_duration_seconds_bucket{le="0.5"} 156
   ```

2. **Checked ServiceMonitor existence:**
   ```bash
   kubectl get servicemonitor -n observability
   
   # ✅ backend-monitor exists
   ```

3. **Checked Prometheus targets:**
   ```bash
   kubectl port-forward -n observability svc/prometheus 9090:9090
   # Opened http://localhost:9090/targets
   
   # ❌ backend-monitor target not listed
   ```

4. **Examined ServiceMonitor labels:**
   ```bash
   kubectl get servicemonitor backend-monitor -n observability -o yaml
   
   # Found the issue:
   metadata:
     labels:
       app: backend  # ❌ Missing required label
   ```

5. **Checked Prometheus Operator configuration:**
   ```bash
   kubectl get prometheus -n observability -o yaml
   
   # Found serviceMonitorSelector:
   spec:
     serviceMonitorSelector:
       matchLabels:
         release: prometheus  # 🔑 Required label for discovery
   ```

**Root Cause:**
Prometheus Operator uses label selectors to discover ServiceMonitors. The `release: prometheus` label was missing from the ServiceMonitor, so Prometheus ignored it.

**Solution:**
Updated ServiceMonitor with required label:
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: observability
  labels:
    release: prometheus  # ✅ Added this label
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

**Result:**
- Metrics appeared in Prometheus within 30 seconds
- Grafana dashboards populated with real-time data
- Alerts started evaluating correctly

**Lesson Learned:**
- Prometheus Operator requires specific labels for ServiceMonitor discovery
- Always check operator's `serviceMonitorSelector` when resources aren't discovered
- Use `kubectl get prometheus -o yaml` to verify label requirements
- Test metric scraping immediately after deploying ServiceMonitors

---

### Challenge 4: Alertmanager Email Notifications Not Sending

**Problem:**
PrometheusRules were firing correctly in Prometheus UI, but no email alerts were received.

**Debugging Process:**

1. **Verified alerts were firing:**
   ```bash
   kubectl port-forward -n observability svc/prometheus 9090:9090
   # Checked /alerts endpoint
   # ✅ HighFailureRate alert showing FIRING state
   ```

2. **Checked Alertmanager status:**
   ```bash
   kubectl port-forward -n observability svc/alertmanager 9093:9093
   # Opened http://localhost:9093
   # ✅ Alert visible in Alertmanager UI
   ```

3. **Examined Alertmanager logs:**
   ```bash
   kubectl logs -n observability alertmanager-xxx
   
   # Found error:
   level=error msg="Notify failed" err="EOF"
   ```

4. **Reviewed Alertmanager configuration:**
   ```yaml
   receivers:
   - name: email
     email_configs:
     - to: akingbadeomosebi@gmail.com
       from: akingbadeomosebi@gmail.com
       smarthost: smtp.gmail.com:587
       # ❌ Missing TLS configuration
   ```

**Root Cause:**
Gmail SMTP requires TLS/STARTTLS configuration and app-specific password (not regular Gmail password). Configuration was missing `require_tls: true`.

**Solution:**

1. Generated Gmail app-specific password:
   - Enabled 2FA on Google account
   - Created app password: Settings → Security → App passwords

2. Updated Alertmanager configuration:
   ```yaml
   receivers:
   - name: email
     email_configs:
     - to: akingbadeomosebi@gmail.com
       from: akingbadeomosebi@gmail.com
       smarthost: smtp.gmail.com:587
       auth_username: akingbadeomosebi@gmail.com
       auth_password: qcyu pbap jfsz qfng  # App password (not regular password)
       require_tls: true  # ✅ Added this
       headers:
         Subject: '[ALERT] {{ .GroupLabels.alertname }}'
   ```

3. Applied configuration:
   ```bash
   kubectl delete secret alertmanager-config -n observability
   kubectl create secret generic alertmanager-config \
     --from-file=alertmanager.yaml -n observability
   kubectl rollout restart deployment alertmanager -n observability
   ```

**Result:**
Email notifications started arriving within 1 minute of alert firing.

**Lesson Learned:**
- Gmail SMTP requires app-specific passwords and TLS configuration
- Always test email notifications with a manual alert trigger
- Store SMTP credentials in Kubernetes Secrets (never commit to Git)
- Add `.gitignore` entry for any files containing credentials

---

### Challenge 5: Fluent Bit Not Parsing JSON Logs

**Problem:**
Kibana showed raw JSON strings instead of parsed fields, making log filtering impossible.

**Example Log in Kibana:**
```
log: "{\"level\":\"info\",\"message\":\"Transfer successful\",\"userId\":\"akingbade\",\"amount\":500}"
```

**Expected (parsed fields):**
```
level: info
message: Transfer successful
userId: akingbade
amount: 500
```

**Root Cause:**
Fluent Bit configuration was missing JSON parser for Kubernetes logs.

**Solution:**
Updated Fluent Bit ConfigMap with JSON parser:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: observability
data:
  fluent-bit.conf: |
    [INPUT]
        Name              tail
        Path              /var/log/containers/*.log
        Parser            docker
        Tag               kube.*
        Refresh_Interval  5

    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Merge_Log           On  # ✅ Merge parsed JSON into record
        Keep_Log            Off # ✅ Remove raw log field

    [FILTER]
        Name parser
        Match kube.*
        Key_Name log
        Parser json  # ✅ Parse JSON logs

    [OUTPUT]
        Name            es
        Match           *
        Host            elasticsearch
        Port            9200
        Logstash_Format On
        Logstash_Prefix kube
        Retry_Limit     False

  parsers.conf: |
    [PARSER]
        Name   json
        Format json
        Time_Key time
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ
```

**Result:**
- Logs appeared in Kibana with individual fields
- Enabled filtering by `level`, `userId`, `method`, `path`
- Created visualizations based on structured fields

**Lesson Learned:**
- Always configure JSON parsing for structured application logs
- Use `Merge_Log On` to flatten JSON into top-level fields
- Test log parsing with sample queries before building dashboards

---

## CI/CD & Security

### Challenge 6: GitHub Actions OIDC Configuration

**Problem:**
Initial CI/CD pipeline stored AWS access keys as GitHub Secrets, violating security best practices (long-lived credentials).

**Goal:**
Implement OIDC federation for keyless authentication (no stored credentials).

**Implementation Steps:**

1. **Created OIDC provider in AWS:**
   ```hcl
   resource "aws_iam_openid_connect_provider" "github" {
     url = "https://token.actions.githubusercontent.com"
     
     client_id_list = ["sts.amazonaws.com"]
     
     thumbprint_list = [
       "6938fd4d98bab03faadb97b34396831e3780aea1"
     ]
   }
   ```

2. **Created IAM role with trust policy:**
   ```hcl
   resource "aws_iam_role" "github_actions" {
     name = "github-actions-observeops"

     assume_role_policy = jsonencode({
       Version = "2012-10-17"
       Statement = [
         {
           Effect = "Allow"
           Principal = {
             Federated = aws_iam_openid_connect_provider.github.arn
           }
           Action = "sts:AssumeRoleWithWebIdentity"
           Condition = {
             StringEquals = {
               "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
             }
             StringLike = {
               "token.actions.githubusercontent.com:sub" = "repo:AkingbadeOmosebi/ObserveOps:*"
             }
           }
         }
       ]
     })
   }
   ```

3. **Updated GitHub Actions workflow:**
   ```yaml
   name: Deploy to EKS
   
   on:
     push:
       branches: [main]
   
   permissions:
     id-token: write  # ✅ Required for OIDC
     contents: read
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - name: Configure AWS credentials
           uses: aws-actions/configure-aws-credentials@v4
           with:
             role-to-assume: arn:aws:iam::194722436853:role/github-actions-observeops
             aws-region: eu-central-1
             # ✅ No access keys needed
   ```

**Challenges Encountered:**

1. **Initial Error:**
   ```
   Error: Not authorized to perform sts:AssumeRoleWithWebIdentity
   ```
   
   **Fix:** Added `id-token: write` permission to workflow

2. **Second Error:**
   ```
   Error: Subject claim doesn't match
   ```
   
   **Fix:** Updated trust policy condition to match exact repo:
   ```json
   "token.actions.githubusercontent.com:sub": "repo:AkingbadeOmosebi/ObserveOps:*"
   ```

**Result:**
- Zero credentials stored in GitHub Secrets
- Temporary credentials generated per workflow run (1-hour TTL)
- Improved security posture (no credential leakage risk)

**Lesson Learned:**
- OIDC federation is production best practice (no long-lived keys)
- Trust policy must match exact repository path
- Requires `id-token: write` permission in workflow
- Temporary credentials expire automatically (better security)

---

### Challenge 7: Trivy Container Scanning Timeout

**Problem:**
Security scanning job in GitHub Actions timed out after 6 minutes, blocking deployments:
```
Error: The operation was canceled.
```

**Root Cause:**
Trivy downloads a vulnerability database (~200MB) on every run. Slow GitHub Actions network caused timeouts.

**Solution:**

1. **Added Trivy database caching:**
   ```yaml
   - name: Cache Trivy DB
     uses: actions/cache@v3
     with:
       path: .trivy-cache
       key: trivy-db-${{ github.run_id }}
       restore-keys: trivy-db-
   
   - name: Run Trivy scan
     uses: aquasecurity/trivy-action@master
     with:
       image-ref: ghcr.io/${{ github.repository }}/backend:latest
       format: 'sarif'
       cache-dir: .trivy-cache  # ✅ Use cached DB
   ```

2. **Parallelized security scans:**
   ```yaml
   jobs:
     security-scan:
       strategy:
         matrix:
           scanner: [gitleaks, trivy, snyk]
       steps:
         - name: Run ${{ matrix.scanner }}
   ```

**Before:**
```
Total pipeline time: 8 minutes
- Security scans: 6 minutes (sequential)
- Build & push: 2 minutes
```

**After:**
```
Total pipeline time: 4 minutes
- Security scans: 2 minutes (parallel)
- Build & push: 2 minutes
```

**Result:**
- 50% reduction in pipeline time
- Reliable scans (no timeouts)
- Better developer experience

**Lesson Learned:**
- Cache external dependencies (databases, packages)
- Parallelize independent jobs
- Set reasonable timeouts (10min for security scans)
- Monitor pipeline performance metrics

---

## Application Debugging

### Challenge 8: Redis Connection Refused Errors

**Problem:**
Backend logs showed continuous Redis connection errors:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16)
```

**Debugging Process:**

1. **Checked Redis pod status:**
   ```bash
   kubectl get pods -n app | grep redis
   
   # redis-xxx   1/1   Running   0   5m
   # ✅ Pod running
   ```

2. **Checked Redis service:**
   ```bash
   kubectl get svc redis -n app
   
   # NAME    TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)
   # redis   ClusterIP   10.100.x.x     <none>        6379/TCP
   # ✅ Service exists
   ```

3. **Examined backend environment variables:**
   ```bash
   kubectl get deployment backend -n app -o yaml | grep REDIS
   
   # - name: REDIS_HOST
   #   value: "localhost"  # ❌ Wrong! Should be service name
   # - name: REDIS_PORT
   #   value: "6379"
   ```

**Root Cause:**
Backend was trying to connect to `localhost:6379` instead of using Kubernetes service DNS (`redis:6379`).

**Solution:**
Updated backend deployment with correct service name:
```yaml
env:
  - name: REDIS_HOST
    value: "redis"  # ✅ Kubernetes service name, not localhost
  - name: REDIS_PORT
    value: "6379"
```

**Result:**
Backend connected to Redis successfully. Session storage working.

**Lesson Learned:**
- In Kubernetes, NEVER use `localhost` for inter-pod communication
- Always use Kubernetes service names (DNS resolution)
- Service DNS format: `<service-name>.<namespace>.svc.cluster.local`
- For same namespace: `<service-name>` is sufficient

---

### Challenge 9: Jaeger Traces Not Appearing

**Problem:**
Backend instrumented with OpenTelemetry SDK, but Jaeger UI showed zero traces.

**Debugging Process:**

1. **Verified OpenTelemetry initialization:**
   ```javascript
   // backend/src/tracing.js
   const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
   
   const provider = new NodeTracerProvider();
   provider.register();
   console.log('✅ OpenTelemetry initialized');
   ```

2. **Checked Jaeger collector service:**
   ```bash
   kubectl get svc -n observability | grep jaeger
   
   # jaeger   ClusterIP   10.100.x.x   <none>   4318/TCP,16686/TCP
   # ✅ Service exists on port 4318
   ```

3. **Examined trace exporter configuration:**
   ```javascript
   const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
   
   const exporter = new OTLPTraceExporter({
     url: 'http://jaeger:4317',  // ❌ Wrong port!
   });
   ```

**Root Cause:**
Using OTLP/gRPC port (4317) instead of OTLP/HTTP port (4318).

**Solution:**
Fixed exporter URL to use HTTP protocol and correct port:
```javascript
const exporter = new OTLPTraceExporter({
  url: 'http://jaeger:4318/v1/traces',  // ✅ Correct HTTP endpoint
});
```

**Result:**
Traces appeared in Jaeger UI immediately after deploying fix.

**Lesson Learned:**
- Jaeger supports two OTLP protocols: gRPC (4317) and HTTP (4318)
- OTLP/HTTP is simpler for Node.js apps (no additional gRPC dependencies)
- Always specify full path: `/v1/traces` for OTLP/HTTP
- Test tracing with a simple request immediately after setup

---

## Key Takeaways

### Infrastructure
- ✅ Delete Kubernetes resources before destroying VPC (dependency order matters)
- ✅ AWS network detachment is asynchronous (ENIs can take 5-15 minutes)
- ✅ Balance cost vs. availability (2 NAT Gateways for demo, not 4)
- ✅ Use OIDC federation (no long-lived AWS credentials)

### Observability
- ✅ Prometheus Operator requires specific labels for ServiceMonitor discovery
- ✅ Gmail SMTP needs app passwords and TLS configuration
- ✅ Configure JSON parsing in Fluent Bit for structured logs
- ✅ Always test metric scraping and alerting immediately after deployment

### Kubernetes
- ✅ Use Kubernetes service names, NEVER localhost
- ✅ Service DNS: `<service-name>` (same namespace) or `<service-name>.<namespace>.svc.cluster.local`
- ✅ Verify environment variables match service configurations
- ✅ Check pod logs, service endpoints, and DNS resolution when debugging

### CI/CD & Security
- ✅ Cache external dependencies (Trivy DB, npm packages) in CI/CD
- ✅ Parallelize independent jobs for faster pipelines
- ✅ Store credentials in Kubernetes Secrets, never in Git
- ✅ Add sensitive files to `.gitignore` (SMTP passwords, API keys)

### OpenTelemetry & Tracing
- ✅ OTLP has two protocols: gRPC (4317) and HTTP (4318)
- ✅ OTLP/HTTP requires full path: `/v1/traces`
- ✅ Test tracing with sample requests immediately
- ✅ Auto-instrumentation works for Express, HTTP, Redis clients

---

## Production Readiness Checklist

Based on these challenges, here's what a production deployment should include:

**Infrastructure:**
- [ ] Automated cleanup scripts with proper dependency ordering
- [ ] Cost monitoring and alerts for NAT Gateway usage
- [ ] Multi-region deployment for disaster recovery
- [ ] VPC Flow Logs for network debugging

**Observability:**
- [ ] Alert notification testing (PagerDuty, Slack, email)
- [ ] Log retention policies (30-90 days)
- [ ] Metric cardinality monitoring (avoid label explosion)
- [ ] Distributed tracing sampling (production traffic)

**Security:**
- [ ] Secrets rotation policy (30-90 days)
- [ ] Network policies for pod-to-pod traffic
- [ ] Pod Security Standards enforcement
- [ ] Regular security scanning (weekly)

**CI/CD:**
- [ ] Rollback procedures documented
- [ ] Canary deployments for gradual rollout
- [ ] Integration tests in pipeline
- [ ] Performance testing before production

---

**This documentation serves as both a learning resource and interview preparation material, demonstrating real-world problem-solving in production Kubernetes and AWS environments.**