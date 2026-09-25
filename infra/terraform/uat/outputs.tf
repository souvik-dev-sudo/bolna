output "vm_name" {
  value = google_compute_instance.bolna.name
}

output "zone" {
  value = google_compute_instance.bolna.zone
}

output "vm_internal_ip" {
  value = google_compute_instance.bolna.network_interface[0].network_ip
}

output "vm_external_ip" {
  value = google_compute_address.vm.address
}

output "ssh_command" {
  value = "gcloud compute ssh ${google_compute_instance.bolna.name} --zone=${var.zone} --project=${var.project_id} --tunnel-through-iap"
}

output "artifact_registry" {
  description = "Image prefix, e.g. <this>/bolna-app:<tag>"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.bolna.repository_id}"
}

output "secret_ids" {
  description = "Env var name -> Secret Manager secret ID"
  value       = { for k, s in google_secret_manager_secret.app : k => s.secret_id }
}

# Values for the GitHub Actions workflow (repository variables, not secrets)
output "github_workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "github_deployer_service_account" {
  value = google_service_account.deployer.email
}
