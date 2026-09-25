# One VM running the same five containers as the laptop (redis, bolna-app,
# plivo-app, proxy, ngrok). Static external IP (address.tf); SSH over IAP with OS Login.
resource "google_compute_instance" "bolna" {
  name         = "${var.name_prefix}-uat"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [var.name_prefix]

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  attached_disk {
    source      = google_compute_disk.redis_data.id
    device_name = "redis-data"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id

    access_config {
      nat_ip       = google_compute_address.vm.address
      network_tier = "PREMIUM"
    }
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  metadata = {
    enable-oslogin = "TRUE"
    startup-script = templatefile("${path.module}/startup.sh.tftpl", {
      registry_host = "${var.region}-docker.pkg.dev"
    })
  }

  labels = {
    app = var.name_prefix
    env = "uat"
  }

  lifecycle {
    # A newer Ubuntu image in the family should not replace the VM
    ignore_changes = [boot_disk[0].initialize_params[0].image]
  }

  depends_on = [
    google_compute_router_nat.nat,
    google_project_iam_member.vm_roles,
  ]
}
