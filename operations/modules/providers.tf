provider "aws" {
  version = "~> 2.70"
  region  = "eu-west-1"
}

provider "aws" {
  version = "~> 2.70"
  region  = "us-east-1"
  alias   = "global"
}
