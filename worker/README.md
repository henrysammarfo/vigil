# GCP Cloud Run notes for VIGIL worker
#
# Secrets (Secret Manager → env):
#   DATABASE_URL, SESSION_SECRET, TINYFISH_API_KEY, TAVILY_API_KEY,
#   AGENTROUTER_API_KEY, VENICE_API_KEY, BITGET_API_KEY, BITGET_API_SECRET,
#   BITGET_PASSPHRASE, BITGET_PAPER=true, VIGIL_WORKER_TENANT_ID
#
# Deploy sketch:
#   gcloud run deploy vigil-worker --source=./worker --region=REGION \
#     --set-secrets=DATABASE_URL=vigil-database-url:latest,... \
#     --min-instances=1 --cpu=1 --memory=512Mi
#
# Keep BITGET_PAPER=true always. Never attach live-trading secrets.
