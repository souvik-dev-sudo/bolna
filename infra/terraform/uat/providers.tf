provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone

  # Billing Budgets API needs a quota project when called with user credentials
  user_project_override = true
  billing_project       = var.project_id
}
