# Remote state backend stores Terraform state in S3 with encryption and locking
# DynamoDB table prevents concurrent modifications
# terraform {
#  backend "s3" {
#    bucket         = "observeops-terraform-state"
#    key            = "production/terraform.tfstate"
#    region         = "eu-central-1"
#    encrypt        = true
#    dynamodb_table = "terraform-locks"
#  }
# }
