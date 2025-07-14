# terraform/main.tf - Infrastructure as Code
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC for network isolation
resource "aws_vpc" "wanderer_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "wanderer-vpc"
  }
}

# Private subnets for wanderer instances
resource "aws_subnet" "private_subnets" {
  count             = 3
  vpc_id            = aws_vpc.wanderer_vpc.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "wanderer-private-subnet-${count.index + 1}"
  }
}

# NAT Gateway for outbound traffic
resource "aws_nat_gateway" "wanderer_nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_subnet.id

  tags = {
    Name = "wanderer-nat-gateway"
  }
}

# ECS Cluster for containerized deployment
resource "aws_ecs_cluster" "wanderer_cluster" {
  name = "wanderer-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = "production"
  }
}

# ECS Task Definition with security
resource "aws_ecs_task_definition" "wanderer_task" {
  family                   = "wanderer"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "wanderer"
      image = "${aws_ecr_repository.wanderer.repository_url}:latest"
      
      essential = true
      
      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "CRAWLEE_LOG_LEVEL"
          value = "INFO"
        }
      ]
      
      secrets = [
        {
          name      = "WANDERER_ENCRYPTION_KEY"
          valueFrom = aws_ssm_parameter.encryption_key.arn
        },
        {
          name      = "BASIC_PROXIES"
          valueFrom = aws_ssm_parameter.basic_proxies.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.wanderer_logs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
    }
  ])
}

# Auto Scaling for load distribution
resource "aws_appautoscaling_target" "wanderer_scaling_target" {
  max_capacity       = 20
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.wanderer_cluster.name}/${aws_ecs_service.wanderer_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CloudWatch for monitoring
resource "aws_cloudwatch_log_group" "wanderer_logs" {
  name              = "/ecs/wanderer"
  retention_in_days = 7

  tags = {
    Environment = "production"
  }
}

# Secrets Manager for sensitive data
resource "aws_ssm_parameter" "encryption_key" {
  name  = "/wanderer/encryption-key"
  type  = "SecureString"
  value = var.encryption_key

  tags = {
    Environment = "production"
  }
}

---
# vercel.json - Serverless deployment
{
  "version": 2,
  "name": "wanderer",
  "builds": [
    {
      "src": "api/wander.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "CRAWLEE_PURGE_ON_START": "true"
  },
  "functions": {
    "api/wander.js": {
      "maxDuration": 300
    }
  }
}

---
# railway.json - Railway deployment
{
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "numReplicas": 3,
    "sleepApplication": false,
    "restartPolicyType": "ALWAYS"
  }
}

---
# fly.toml - Fly.io deployment
app = "wanderer"
primary_region = "ord"

[build]

[env]
  NODE_ENV = "production"
  CRAWLEE_PURGE_ON_START = "true"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 2
  max_machines_running = 10

  [[http_service.http_checks]]
    interval = "30s"
    timeout = "10s"
    path = "/health"

[vm]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 2048

[[statics]]
  guest_path = "/app/storage"
  url_prefix = "/storage"

---
# github-actions.yml - CI/CD Pipeline
name: Deploy Wanderer

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run security audit
      run: npm audit --audit-level=high
    
    - name: Build Docker image
      run: |
        docker build -t wanderer:${{ github.sha }} .
        docker tag wanderer:${{ github.sha }} wanderer:latest
    
    - name: Security scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'wanderer:latest'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Deploy to production
      env:
        ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
        BASIC_PROXIES: ${{ secrets.BASIC_PROXIES }}
      run: |
        # Deploy to your preferred platform
        echo "Deploying to production..."

      