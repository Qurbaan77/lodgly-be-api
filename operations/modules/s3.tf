resource "aws_s3_bucket" "storage" {
  bucket = "storage.${var.domain_zone}-${var.aws_region}"
  tags = var.tags
}
