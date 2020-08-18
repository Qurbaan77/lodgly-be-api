variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "name" {
  type = string
}

variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "domain" {
  type = string
}

variable "domain_zone" {
  type = string
}

variable "cidr_prefix" {
  type    = number
  default = 10
}

variable "vpc" {
  type = object({
    default = string
  })

  default = {
    default = "vpc-026f8cbf350e9e051"
  }
}

variable "ec2" {
  type = object({
    instances = number
    instance_type = string
    key_name = string
  })

  default = {
    instances = 1
    instance_type = "t2.small"
    key_name = "devel"
  }
}

variable "tags" {
  type    = map(string)
  default = {
    Name        = "Lodgly-Api"
    Terraform   = true
  }
}
