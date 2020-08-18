data "aws_subnet_ids" "all" {
  vpc_id = var.vpc.default
}

module "security_group" {
  source  = "terraform-aws-modules/security-group/aws"
  version = "~> 3.0"

  name        = "${var.environment}-ec2-sg"
  description = "Security group for EC2 instances"
  vpc_id      = var.vpc.default

  ingress_cidr_blocks = ["0.0.0.0/0"]
  ingress_rules       = ["ssh-tcp", "https-443-tcp", "http-80-tcp", "all-icmp"]
  egress_rules        = ["all-all"]
}

module "ec2_cluster" {
  source                  = "terraform-aws-modules/ec2-instance/aws"
  version                 = "~> 2.0"

  name                    = var.environment
  instance_count          = var.ec2.instances

  ami                     = "ami-089cc16f7f08c4457"
  instance_type           = var.ec2.instance_type
  key_name                = var.ec2.key_name
  monitoring              = true
  disable_api_termination	= true
  vpc_security_group_ids  = [module.security_group.this_security_group_id]
  subnet_id               = tolist(data.aws_subnet_ids.all.ids)[0]

  associate_public_ip_address = true

  tags = merge(var.tags, {
    Name = var.environment
  })
}

data "aws_route53_zone" "this" {
  name = var.domain_zone
}

resource "aws_route53_record" "this" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.domain
  type    = "A"
  ttl     = "300"
  records = module.ec2_cluster.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name assigned to the EC2 instance"
  value       = module.ec2_cluster.public_ip
}
