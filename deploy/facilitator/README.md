# x402 Base Facilitator Docker Deployment

This deployment wrapper runs an EVM-only x402 facilitator for Base or Base Sepolia.
It keeps the upstream examples untouched and exposes only:

- `GET /healthz` without auth
- `GET /supported` with bearer auth
- `POST /verify` with bearer auth
- `POST /settle` with bearer auth

## Environment

Create `/opt/x402-deploy/facilitator/.env` from `env.example`.

Use `EVM_NETWORK=eip155:84532` for Base Sepolia, or `EVM_NETWORK=eip155:8453` for
Base mainnet.

`EVM_PRIVATE_KEY` must be a dedicated facilitator key funded with native gas. Do
not reuse the provider `payTo` wallet.

## Compose

Copy `docker-compose.example.yml` to `/opt/x402-deploy/docker-compose.yml`.

The example uses `expose`, not `ports`, so the facilitator stays internal to the
Docker network and does not conflict with Caddy.

## Run

```bash
cd /opt/x402-deploy
docker compose build facilitator
docker compose up -d facilitator
docker compose logs -f facilitator
```

## Smoke Test

```bash
TOKEN="$(grep FACILITATOR_AUTH_TOKEN /opt/x402-deploy/facilitator/.env | cut -d= -f2-)"

docker run --rm --network x402_internal curlimages/curl:latest \
  -H "Authorization: Bearer ${TOKEN}" \
  http://facilitator:4022/supported
```
