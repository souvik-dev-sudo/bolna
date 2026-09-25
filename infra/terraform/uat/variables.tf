variable "project_id" {
  description = "GCP project ID (billing must be linked)"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "zone" {
  description = "GCP zone for the VM and its disks"
  type        = string
  default     = "asia-south1-a"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "bolna"
}

variable "subnet_cidr" {
  description = "CIDR range of the VM subnet"
  type        = string
  default     = "10.10.0.0/24"
}

variable "machine_type" {
  description = "VM size (e2-standard-2 = 2 vCPU, 8 GB)"
  type        = string
  default     = "e2-standard-2"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB (Docker images live here)"
  type        = number
  default     = 30
}

variable "redis_disk_size_gb" {
  description = "Size of the separate disk that keeps Redis data (agents) across redeploys"
  type        = number
  default     = 10
}

variable "github_repo" {
  description = "GitHub repo allowed to deploy through Workload Identity, as owner/name"
  type        = string
}

variable "budget_enabled" {
  description = "Create a budget alert (needs Billing Account Administrator or Costs Manager on the billing account)"
  type        = bool
  default     = false
}

variable "billing_account_id" {
  description = "Billing account ID for the budget alert, e.g. 01284A-80ADC6-A651A6"
  type        = string
  default     = ""
}

variable "budget_amount_inr" {
  description = "Monthly budget in INR; alerts at 50%, 90% and 100%"
  type        = number
  default     = 8000
}
