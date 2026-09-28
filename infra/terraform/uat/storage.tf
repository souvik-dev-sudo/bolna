# Call recordings: Plivo MP3s that plivo-app copies here after each call.
# Named after the project because bucket names are global.
resource "google_storage_bucket" "call_recordings" {
  name     = "${var.project_id}-call-recordings"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.services]
}

# Write-only: the VM can add recordings but not read, overwrite or delete them
resource "google_storage_bucket_iam_member" "vm_writes_recordings" {
  bucket = google_storage_bucket.call_recordings.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.vm.email}"
}
