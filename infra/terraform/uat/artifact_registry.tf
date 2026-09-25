# Docker images for bolna-app and plivo-app, built and pushed by GitHub Actions
resource "google_artifact_registry_repository" "bolna" {
  repository_id = var.name_prefix
  location      = var.region
  format        = "DOCKER"
  description   = "Bolna voice agent images"

  # Keep the 10 newest versions of each image
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_artifact_registry_repository_iam_member" "deployer_writes" {
  location   = google_artifact_registry_repository.bolna.location
  repository = google_artifact_registry_repository.bolna.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_artifact_registry_repository_iam_member" "vm_reads" {
  location   = google_artifact_registry_repository.bolna.location
  repository = google_artifact_registry_repository.bolna.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm.email}"
}
