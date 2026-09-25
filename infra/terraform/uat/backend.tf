# One-time bootstrap before the first `terraform init`:
#   gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com \
#     storage.googleapis.com --project=bolna-voice-uat
# State lives in a GCS bucket created by hand:
#   gcloud storage buckets create gs://bolna-voice-uat-tfstate --location=asia-south1 \
#     --uniform-bucket-level-access --public-access-prevention
#   gcloud storage buckets update gs://bolna-voice-uat-tfstate --versioning
terraform {
  backend "gcs" {
    bucket = "bolna-voice-uat-tfstate"
    prefix = "uat"
  }
}
