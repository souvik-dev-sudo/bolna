# Secret containers only. Values are added outside Terraform so they never
# reach state or git:
#   printf '%s' "<value>" | gcloud secrets versions add <secret-id> --data-file=-
# GOOGLE_API_KEY is written from the same secret as GEMINI_API_KEY.
locals {
  secrets = {
    OPENAI_API_KEY     = "${var.name_prefix}-openai-api-key"
    GEMINI_API_KEY     = "${var.name_prefix}-gemini-api-key"
    CARTESIA_API_KEY   = "${var.name_prefix}-cartesia-api-key"
    PLIVO_AUTH_ID      = "${var.name_prefix}-plivo-auth-id"
    PLIVO_AUTH_TOKEN   = "${var.name_prefix}-plivo-auth-token"
    PLIVO_PHONE_NUMBER = "${var.name_prefix}-plivo-phone-number"
    NGROK_AUTHTOKEN    = "${var.name_prefix}-ngrok-authtoken"
  }
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secrets

  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  labels = {
    app     = var.name_prefix
    env_var = lower(each.key)
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "vm_reads_secrets" {
  for_each = google_secret_manager_secret.app

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm.email}"
}
