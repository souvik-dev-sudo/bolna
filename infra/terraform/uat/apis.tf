locals {
  services = [
    "compute.googleapis.com",
    "iap.googleapis.com",
    "oslogin.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "billingbudgets.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]
}

# Left enabled on destroy so other tooling in the project is not affected
resource "google_project_service" "services" {
  for_each = toset(local.services)

  service            = each.value
  disable_on_destroy = false
}
