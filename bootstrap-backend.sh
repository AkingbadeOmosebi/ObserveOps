#!/bin/bash
set -e

BUCKET_NAME="observeops-terraform-state-${RANDOM}"
TABLE_NAME="observeops-terraform-locks"
REGION="eu-central-1"

echo "Creating S3 bucket: $BUCKET_NAME"
aws s3api create-bucket \
  --bucket $BUCKET_NAME \
  --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION

aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket $BUCKET_NAME \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

echo "Creating DynamoDB table: $TABLE_NAME"
aws dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo ""
echo " Bootstrap complete!"
echo ""
echo "Update terraform/backend.tf with:"
echo "  bucket = \"$BUCKET_NAME\""
echo "  region = \"$REGION\""
echo "  dynamodb_table = \"$TABLE_NAME\""
