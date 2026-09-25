# SSH only through Identity-Aware Proxy, only to VMs tagged "bolna".
# Nothing else is allowed in; calls arrive over ngrok's outgoing tunnel.
resource "google_compute_firewall" "allow_iap_ssh" {
  name      = "${var.name_prefix}-allow-iap-ssh"
  network   = google_compute_network.vpc.id
  direction = "INGRESS"

  source_ranges = ["35.235.240.0/20"]
  target_tags   = [var.name_prefix]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
