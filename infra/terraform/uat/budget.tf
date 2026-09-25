# Optional: emails billing admins at 50%, 90% and 100% of the monthly budget.
# Creating a budget needs Billing Account Administrator or Billing Account
# Costs Manager on the billing account, so it is off by default.
data "google_project" "this" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly" {
  count = var.budget_enabled ? 1 : 0

  billing_account = var.billing_account_id
  display_name    = "${var.name_prefix}-uat-monthly"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = "INR"
      units         = tostring(var.budget_amount_inr)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.services]
}
