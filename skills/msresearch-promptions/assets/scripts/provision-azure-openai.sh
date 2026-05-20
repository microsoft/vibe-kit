#!/usr/bin/env bash
# Provision an Azure OpenAI GPT-4-family deployment for the Promptions chatbot.
#
# Idempotent: re-running with the same names is safe (Azure CLI no-ops existing
# resources). Writes the four required values into the per-app .env files
# (apps/promptions-chat/.env and apps/promptions-image/.env) unless --dry-run
# is passed.
#
# Usage:
#   assets/scripts/provision-azure-openai.sh [--dry-run] [--non-interactive]
#
# Env-var overrides (skip prompts when set):
#   AZ_SUBSCRIPTION       Azure subscription ID
#   AZ_RESOURCE_GROUP     Resource group name (created if missing)
#   AZ_REGION             Azure region (default: eastus2)
#   AZ_RESOURCE_NAME      Cognitive Services resource name
#   AZ_DEPLOYMENT_NAME    Deployment name (this is what VITE_OPENAI_MODEL will be set to)
#   AZ_MODEL              Model to deploy (default: gpt-4.1-mini)
#   AZ_MODEL_VERSION      Model version (default: 2025-04-14 for gpt-4.1-mini; required by Azure CLI)
#                         Update this default when Azure rotates the GA version:
#                         https://learn.microsoft.com/azure/ai-services/openai/concepts/models
#   AZ_API_VERSION        Azure OpenAI REST API version (default: 2024-12-01-preview)
#   PROMPTIONS_CHAT_ENV_PATH   Path to chat-app .env (default: ./promptions-app/apps/promptions-chat/.env)
#   PROMPTIONS_IMAGE_ENV_PATH  Path to image-app .env (default: ./promptions-app/apps/promptions-image/.env)

set -euo pipefail

DRY_RUN=0
NON_INTERACTIVE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)         DRY_RUN=1 ;;
    --non-interactive) NON_INTERACTIVE=1 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
err()  { printf '\033[31m%s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }

# --- 1. Preflight: az CLI installed and logged in ---------------------------
if ! command -v az >/dev/null 2>&1; then
  err "Azure CLI (az) not found. Install it: https://learn.microsoft.com/cli/azure/install-azure-cli"
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  err "Not logged in to Azure. Run: az login"
  exit 1
fi

# --- 2. Gather inputs --------------------------------------------------------
prompt() {
  # prompt VARNAME "Question" "default"
  local varname="$1" question="$2" default="$3" current="${!1:-}"
  if [[ -n "$current" ]]; then
    return 0
  fi
  if [[ "$NON_INTERACTIVE" == "1" ]]; then
    if [[ -n "$default" ]]; then
      printf -v "$varname" '%s' "$default"
    else
      err "Missing required value for $varname in --non-interactive mode."
      exit 2
    fi
    return 0
  fi
  local reply
  if [[ -n "$default" ]]; then
    read -r -p "$question [$default]: " reply
    printf -v "$varname" '%s' "${reply:-$default}"
  else
    read -r -p "$question: " reply
    printf -v "$varname" '%s' "$reply"
  fi
}

bold "Provisioning Azure OpenAI for Promptions chatbot"
echo

DEFAULT_SUB="$(az account show --query id -o tsv)"
DEFAULT_SUB_NAME="$(az account show --query name -o tsv)"
info "Default subscription: $DEFAULT_SUB_NAME ($DEFAULT_SUB)"

prompt AZ_SUBSCRIPTION    "Subscription ID"                     "$DEFAULT_SUB"
prompt AZ_RESOURCE_GROUP  "Resource group name"                 "promptions-rg"
prompt AZ_REGION          "Region"                              "eastus2"
prompt AZ_RESOURCE_NAME   "Cognitive Services resource name"    "promptions-aoai-$RANDOM"
prompt AZ_DEPLOYMENT_NAME "Deployment name (= VITE_OPENAI_MODEL)" "promptions-chat"
prompt AZ_MODEL           "Model"                               "gpt-4.1-mini"
# Azure CLI requires --model-version explicitly. Update default if Azure rotates the GA version.
# Current matrix: https://learn.microsoft.com/azure/ai-services/openai/concepts/models
prompt AZ_MODEL_VERSION   "Model version (required by Azure CLI)" "2025-04-14"
prompt AZ_API_VERSION     "Azure OpenAI REST API version"       "2024-12-01-preview"

if [[ -z "$AZ_MODEL_VERSION" ]]; then
  err "AZ_MODEL_VERSION is required. Azure CLI rejects empty --model-version."
  err "See: https://learn.microsoft.com/azure/ai-services/openai/concepts/models"
  exit 2
fi

az account set --subscription "$AZ_SUBSCRIPTION"

PROMPTIONS_CHAT_ENV_PATH="${PROMPTIONS_CHAT_ENV_PATH:-./promptions-app/apps/promptions-chat/.env}"
PROMPTIONS_IMAGE_ENV_PATH="${PROMPTIONS_IMAGE_ENV_PATH:-./promptions-app/apps/promptions-image/.env}"

echo
bold "Plan:"
echo "  Subscription:  $AZ_SUBSCRIPTION"
echo "  Resource grp:  $AZ_RESOURCE_GROUP (created if missing)"
echo "  Region:        $AZ_REGION"
echo "  Resource:      $AZ_RESOURCE_NAME"
echo "  Deployment:    $AZ_DEPLOYMENT_NAME"
echo "  Model:         $AZ_MODEL (version $AZ_MODEL_VERSION)"
echo "  API version:   $AZ_API_VERSION"
echo "  Write .env to: $PROMPTIONS_CHAT_ENV_PATH"
echo "                 $PROMPTIONS_IMAGE_ENV_PATH"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  warn "--dry-run set. Exiting without making changes."
  exit 0
fi

if [[ "$NON_INTERACTIVE" != "1" ]]; then
  read -r -p "Proceed? [y/N] " confirm
  [[ "${confirm:-N}" =~ ^[Yy]$ ]] || { warn "Aborted."; exit 1; }
fi

# --- 3. Create resource group -----------------------------------------------
info "Ensuring resource group $AZ_RESOURCE_GROUP exists in $AZ_REGION..."
az group create --name "$AZ_RESOURCE_GROUP" --location "$AZ_REGION" --output none

# --- 4. Create Cognitive Services (Azure OpenAI) account --------------------
info "Ensuring Cognitive Services account $AZ_RESOURCE_NAME exists..."
if ! az cognitiveservices account show \
      --name "$AZ_RESOURCE_NAME" \
      --resource-group "$AZ_RESOURCE_GROUP" >/dev/null 2>&1; then
  az cognitiveservices account create \
    --name "$AZ_RESOURCE_NAME" \
    --resource-group "$AZ_RESOURCE_GROUP" \
    --location "$AZ_REGION" \
    --kind OpenAI \
    --sku S0 \
    --yes \
    --output none
else
  info "Account already exists; skipping create."
fi

# --- 5. Create model deployment ---------------------------------------------
info "Ensuring deployment $AZ_DEPLOYMENT_NAME exists..."
if ! az cognitiveservices account deployment show \
      --name "$AZ_RESOURCE_NAME" \
      --resource-group "$AZ_RESOURCE_GROUP" \
      --deployment-name "$AZ_DEPLOYMENT_NAME" >/dev/null 2>&1; then
  DEPLOY_ARGS=(
    --name "$AZ_RESOURCE_NAME"
    --resource-group "$AZ_RESOURCE_GROUP"
    --deployment-name "$AZ_DEPLOYMENT_NAME"
    --model-name "$AZ_MODEL"
    --model-version "$AZ_MODEL_VERSION"
    --model-format OpenAI
    --sku-name "Standard"
    --sku-capacity 10
  )
  if ! az cognitiveservices account deployment create "${DEPLOY_ARGS[@]}" --output none 2>/tmp/promptions_deploy_err; then
    err "Deployment failed. Common causes:"
    err "  - Model '$AZ_MODEL' version '$AZ_MODEL_VERSION' not available in region '$AZ_REGION'."
    err "    Try a fallback: gpt-4o-mini, gpt-4o."
    err "    Region + version matrix:"
    err "    https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-table-and-region-availability"
    err "  - Quota not yet granted for your subscription."
    err "    Request quota: https://aka.ms/oai/quotaincrease"
    err ""
    cat /tmp/promptions_deploy_err >&2
    exit 1
  fi
else
  info "Deployment already exists; skipping create."
fi

# --- 6. Read endpoint + key --------------------------------------------------
ENDPOINT="$(az cognitiveservices account show \
  --name "$AZ_RESOURCE_NAME" \
  --resource-group "$AZ_RESOURCE_GROUP" \
  --query properties.endpoint -o tsv)"

API_KEY="$(az cognitiveservices account keys list \
  --name "$AZ_RESOURCE_NAME" \
  --resource-group "$AZ_RESOURCE_GROUP" \
  --query key1 -o tsv)"

# Promptions' AzureOpenAI SDK client expects the bare resource endpoint and
# appends `/openai/...` internally. Do NOT add a `/openai` suffix here — that
# produces 404 when the SDK requests `.../openai/openai/deployments/...`.
# Raw REST calls (e.g., the curl smoke test below) DO need `/openai/` in the
# URL template — we add it explicitly there, not in the env var.
BASE_URL="${ENDPOINT%/}"

# --- 7. Smoke-test the deployment --------------------------------------------
info "Smoke-testing deployment..."
SMOKE_URL="${BASE_URL}/openai/deployments/${AZ_DEPLOYMENT_NAME}/chat/completions?api-version=${AZ_API_VERSION}"
HTTP_CODE="$(curl -s -o /tmp/promptions_smoke.json -w "%{http_code}" \
  -X POST "$SMOKE_URL" \
  -H "Content-Type: application/json" \
  -H "api-key: $API_KEY" \
  -d '{"messages":[{"role":"user","content":"ping"}],"max_tokens":5}')"

if [[ "$HTTP_CODE" != "200" ]]; then
  err "Smoke test failed: HTTP $HTTP_CODE"
  err "Response body:"
  cat /tmp/promptions_smoke.json >&2
  err ""
  err "Common causes:"
  err "  - 401: API key wrong (regenerate or re-run this script)"
  err "  - 404: Deployment name mismatch — confirm VITE_OPENAI_MODEL = deployment name, not model name"
  err "  - 429: Capacity / rate limit — request quota at https://aka.ms/oai/quotaincrease"
  exit 1
fi
info "Smoke test passed (HTTP 200)."

# --- 8. Write .env files -----------------------------------------------------
# Promptions reads VITE_OPENAI_* vars from per-app .env files (Vite convention).
# We write to both the chat and image app .env files.

write_env() {
  local target="$1"
  local app_dir
  app_dir="$(dirname "$target")"

  if [[ ! -d "$app_dir" ]]; then
    warn "Directory $app_dir does not exist. Skipping write for $target."
    return 1
  fi

  # Back up existing .env (if any) before rewriting Promptions-managed keys.
  if [[ -f "$target" ]]; then
    cp "$target" "${target}.bak.$(date +%s)"
    # Strip any prior Promptions-managed VITE_OPENAI_* keys before re-appending.
    local tmp
    tmp="$(mktemp)"
    grep -vE '^(VITE_OPENAI_API_KEY|VITE_OPENAI_BASE_URL|VITE_OPENAI_API_VERSION|VITE_OPENAI_MODEL)=' \
      "$target" > "$tmp" || true
    mv "$tmp" "$target"
  fi

  cat >> "$target" <<EOF
# --- Azure OpenAI (provisioned by provision-azure-openai.sh) ---
VITE_OPENAI_API_KEY=$API_KEY
VITE_OPENAI_BASE_URL=$BASE_URL
VITE_OPENAI_API_VERSION=$AZ_API_VERSION
VITE_OPENAI_MODEL=$AZ_DEPLOYMENT_NAME
EOF
  info "Wrote Azure OpenAI credentials to: $target"
  return 0
}

WROTE_ANY=0
if write_env "$PROMPTIONS_CHAT_ENV_PATH"; then WROTE_ANY=1; fi
if write_env "$PROMPTIONS_IMAGE_ENV_PATH"; then WROTE_ANY=1; fi

if [[ "$WROTE_ANY" == "0" ]]; then
  warn "No .env files written. Run this script from the kit root after cloning"
  warn "promptions-app/, or set PROMPTIONS_CHAT_ENV_PATH / PROMPTIONS_IMAGE_ENV_PATH."
  echo
  bold "Values to set manually in apps/promptions-chat/.env (and apps/promptions-image/.env):"
  echo "  VITE_OPENAI_API_KEY=$API_KEY"
  echo "  VITE_OPENAI_BASE_URL=$BASE_URL"
  echo "  VITE_OPENAI_API_VERSION=$AZ_API_VERSION"
  echo "  VITE_OPENAI_MODEL=$AZ_DEPLOYMENT_NAME"
  exit 0
fi

bold "Done."
info "VITE_OPENAI_MODEL is set to the deployment name ($AZ_DEPLOYMENT_NAME), not the model name. This is required by Azure OpenAI."
info "VITE_OPENAI_BASE_URL has NO /openai suffix — the AzureOpenAI SDK client appends that itself."
echo
info "Next: launch the chatbot per docs/quick-start.md §2.3."
