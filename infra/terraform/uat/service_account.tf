# Identity of the VM: reads secrets, pulls images, writes logs and metrics
resource "google_service_account" "vm" {
  account_id   = "${var.name_prefix}-vm"
  display_name = "Bolna VM"

  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "vm_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/aiplatform.user", # Gemini LLM and Live transcription on Vertex AI
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.vm.email}"
}

# Identity GitHub Actions uses to deploy: pushes images and SSHes to the VM over IAP
resource "google_service_account" "deployer" {
  account_id   = "${var.name_prefix}-deployer"
  display_name = "Bolna GitHub deployer"

  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/compute.osAdminLogin",       # sudo over OS Login
    "roles/compute.viewer",             # gcloud compute ssh looks up the VM
    "roles/iap.tunnelResourceAccessor", # SSH through IAP
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# OS Login on a VM with a service account also requires actAs on that account
resource "google_service_account_iam_member" "deployer_act_as_vm" {
  service_account_id = google_service_account.vm.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
