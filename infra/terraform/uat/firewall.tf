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

# Direct access to the app ports (plain HTTP) from the CIDRs in var.backend_allowed_cidrs.
# Redis (6379) and the ngrok API (4040) stay closed. Empty the list to remove the rule.
resource "google_compute_firewall" "allow_backend" {
  count     = length(var.backend_allowed_cidrs) > 0 ? 1 : 0
  name      = "${var.name_prefix}-allow-backend"
  network   = google_compute_network.vpc.id
  direction = "INGRESS"

  source_ranges = var.backend_allowed_cidrs
  target_tags   = [var.name_prefix]

  allow {
    protocol = "tcp"
    ports    = ["5001", "8002"]
  }
}
