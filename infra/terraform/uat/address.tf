# Static external IP for the VM, kept across stop/start.
# Only the IAP SSH rule in firewall.tf allows traffic in; open more ports there
# explicitly (the containers listen on 5001, 8002, 6379 and 4040).
resource "google_compute_address" "vm" {
  name         = "${var.name_prefix}-uat-ip"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"

  depends_on = [google_project_service.services]
}
