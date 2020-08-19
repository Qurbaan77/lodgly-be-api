terraform {
  required_version = "0.12.29"

  backend "s3" {
    bucket  = "terraform-infrastructure-state-eu-west-1"
    region  = "eu-west-1"
    key     = "lodgly/aws/backend.tfstate"
    encrypt = true

    dynamodb_table = "terraform-lock-global"
  }
}

provider "aws" {
  version = "~> 2.70"
  region  = "eu-west-1"
}

provider "aws" {
  version = "~> 2.70"
  region  = "us-east-1"
  alias   = "global"
}

module "lodgly_com" {
  source = "./modules"

  environment = "production"
  domain      = "api.lodgly.com"
  domain_zone = "lodgly.com"

  name        = "Lodgly"
  project     = "lodgly-backend-api"

  ec2 = {
    instances     = 1
    instance_type = "t2.medium"
    key_name      = "prod"
  }

  tags = {
    Name        = "Lodgly-Api"
    Terraform   = true
    Environment = "production"
  }

  providers = {
    aws        = aws
    aws.global = aws.global
  }
}
