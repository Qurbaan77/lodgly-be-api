# VPC
resource "aws_vpc" "this" {
  cidr_block           = "${var.cidr_prefix}.0.0.0/16"
  enable_dns_hostnames = true
  tags                 = { Name = var.environment }
}

resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  ingress {
    protocol    = -1
    from_port   = 0
    to_port     = 0
    cidr_blocks = [aws_vpc.this.cidr_block]
  }

  egress {
    protocol    = -1
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_eip" "this" {
  vpc = true
}

# Route tables

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.environment}-private-route-table" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.environment}-public-route-table" }
}

# public 1a
resource "aws_subnet" "public_1a" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.0.0/20"
  availability_zone_id = "euw1-az3"
  tags                 = { Name = "${var.environment}-public-1a" }
}

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

# public 1b
resource "aws_subnet" "public_1b" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.16.0/20"
  availability_zone_id = "euw1-az1"
  tags                 = { Name = "${var.environment}-public-1b" }
}

resource "aws_route_table_association" "public_1b" {
  subnet_id      = aws_subnet.public_1b.id
  route_table_id = aws_route_table.public.id
}

# public 1c

resource "aws_subnet" "public_1c" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.32.0/20"
  availability_zone_id = "euw1-az2"
  tags                 = { Name = "${var.environment}-public-1c" }
}

resource "aws_route_table_association" "public_1c" {
  subnet_id      = aws_subnet.public_1c.id
  route_table_id = aws_route_table.public.id
}

# private 1a

resource "aws_subnet" "private_1a" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.48.0/20"
  availability_zone_id = "euw1-az3"
  tags                 = { Name = "${var.environment}-private-1a" }
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private.id
}

# private 1b

resource "aws_subnet" "private_1b" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.64.0/20"
  availability_zone_id = "euw1-az1"
  tags                 = { Name = "${var.environment}-private-1b" }
}

resource "aws_route_table_association" "private_1b" {
  subnet_id      = aws_subnet.private_1b.id
  route_table_id = aws_route_table.private.id
}

# private 1c

resource "aws_subnet" "private_1c" {
  vpc_id               = aws_vpc.this.id
  cidr_block           = "${var.cidr_prefix}.0.80.0/20"
  availability_zone_id = "euw1-az2"
  tags                 = { Name = "${var.environment}-private-1c" }
}

resource "aws_route_table_association" "private_1c" {
  subnet_id      = aws_subnet.private_1c.id
  route_table_id = aws_route_table.private.id
}

# Gateways

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.this.id
  subnet_id     = aws_subnet.public_1a.id
  tags          = { Name = "${var.environment}-nat-gateway" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.environment}-internet-gateway" }
}

# Routes

resource "aws_route" "public" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route" "private" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}
