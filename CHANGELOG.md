## [1.1.1](https://github.com/AkingbadeOmosebi/ObserveOps/compare/v1.1.0...v1.1.1) (2026-03-29)


### Bug Fixes

* converted GHA env name to lowercase ([8af60b6](https://github.com/AkingbadeOmosebi/ObserveOps/commit/8af60b623754ff1034c980727e1c9e388827f3f3))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-03-29

### Documentation
- Add comprehensive README with architecture diagram
- Add setup and deployment instructions
- Include screenshots and usage examples

## [1.1.0] - 2026-03-29

### Added
- Hero landing animation with payment illustration
- User avatar circles in dashboard header
- Enhanced balance card with currency symbol
- Improved transaction icons with colored backgrounds
- Empty state illustration for transaction history
- Background pattern on login page

### Changed
- Updated UI components for better visual hierarchy
- Improved responsive design for mobile devices

## [1.0.0] - 2026-03-28

### Added
- Full-stack payment platform with authentication
- Redis-based session and transaction storage
- OpenTelemetry instrumentation for distributed tracing
- Prometheus metrics with custom business KPIs
- Structured JSON logging for all events
- React frontend with login and dashboard
- Transfer money functionality with validation
- Transaction history tracking
- Kubernetes manifests for observability stack
- Prometheus, Grafana, and Alertmanager configuration
- Elasticsearch, Fluentbit, and Kibana (EFK stack)
- Jaeger distributed tracing
- Production-ready Dockerfiles
- Docker Compose for local development
- Terraform infrastructure for AWS EKS
- VPC and networking configuration
- EKS cluster with OIDC provider

### Security
- Bcrypt password hashing
- Session-based authentication
- Non-root Docker containers
- Security headers in nginx configuration
