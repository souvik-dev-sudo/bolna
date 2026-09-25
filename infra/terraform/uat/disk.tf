# Separate disk for Redis data, so agents survive VM recreation and redeploys.
# Mounted at /mnt/redis-data by the startup script.
resource "google_compute_disk" "redis_data" {
  name = "${var.name_prefix}-redis-data"
  type = "pd-balanced"
  zone = var.zone
  size = var.redis_disk_size_gb

  labels = {
    app = var.name_prefix
  }

  depends_on = [google_project_service.services]
}
