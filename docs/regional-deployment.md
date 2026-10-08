# Automatic regional pricing

The current environment is local/ngrok. It has no authenticated country metadata.
Roblox checkout therefore stays unavailable until location can be verified. There
is no default ID region and no buyer-controlled region override. Apps Premium
retains its existing IDR flow; historical invoices always use their stored snapshot.

## Trusted ingress contract (disabled until deployed and verified)

`src/lib/requestRegion.ts` accepts only an HMAC-authenticated attestation from an
operator-controlled ingress that performs reliable GeoIP. It does not treat raw
`CF-IPCountry`, `X-Vercel-IP-Country`, `X-Forwarded-For`, cookies, language, URL or
request-body country values as trusted evidence. ngrok alone does not provide
this contract. No live ingress/GeoIP provider has been configured or verified.

Before enabling, the operator must protect the origin with a private connection,
firewall or mTLS, ensure the ingress removes all incoming `x-store-geo-*` headers,
and derive country from the actual connection IP using its trusted GeoIP service.
Forwarded IPs may only be used along a separately authenticated proxy chain.
Never sign a country selected by the browser. Do not expose signatures or the
signing key in responses, logs, client bundles, analytics or public endpoints.

Set these server-only variables only after that deployment is in place:

- `GEOIP_SOURCE=signed-ingress`
- `GEOIP_INGRESS_SECRET`: independent random secret of at least 32 characters
- `GEOIP_INGRESS_AUDIENCE`: unique identifier for this store/environment

For each request, the ingress overwrites:

- `x-store-geo-country`: uppercase two-letter country code
- `x-store-geo-timestamp`: current Unix milliseconds, 13 digits
- `x-store-geo-signature`: lowercase hex HMAC-SHA256 of UTF-8
  `JSON.stringify(['store-geo-v1', audience, method, pathname + search, country, timestamp])`

The exact path/query received by Next.js must match the signed value. Attestations
expire after 60 seconds; clocks must be synchronized. Origin bypass, absent or
invalid signatures, unsupported countries, missing configuration and unavailable
GeoIP all fail closed. An attestation authenticates the ingress's estimate, not
the customer's residence or billing country. Provider billing-country checks
must be added by any future gateway that exposes an authoritative check.

Catalog responses are private/no-store and contain only the detected region's
price and capabilities. Static page shells contain no personal regional price.
Quotes resolve location again, and every new Roblox checkout requires the signed
quote. Region/price changes cannot silently create a differently priced order.
An existing idempotent retry can recover its original invoice even after travel.

## Incorrect detection and support

The storefront links to the same WhatsApp support contact already used by Apps
Premium. Support should investigate VPN/travel and GeoIP errors without requesting
account credentials. There is deliberately no self-service override, admin price
override endpoint, or correction cookie. Until verification is possible checkout
remains blocked. A future correction facility must scope authorization to one
customer/session and a short lifetime, require recent admin authentication and
record the evidence reference, approver, reason, expiry and revocation in an audit.
Do not send buyers a URL or header that selects a cheaper country.

## Payments and database

MYR/PHP payment creation remains disabled: no international merchant account,
adapter or verified webhook is available. GeoIP alone cannot activate payments.
IDR uses the existing Midtrans adapter; tests use mocks, not real settlement.
The three Roblox delivery methods and Apps Premium fulfillment remain separate.

Apply `npx prisma migrate deploy` before starting new app code. Missing regional
columns cause Prisma P2022 in both admin order and fulfillment lists. The pending
assisted-login and regional migrations were applied to the configured database on
2026-10-08 after verifying zero stored Roblox secrets; its three orders and one
stock row remained present. Do not use reset/db push as a deployment workaround.

## Validation

`tests/region.test.mjs` checks authenticated region mapping, spoofing, expiration,
wrong audience/path/method and unknown locations. MySQL tests cover actual order
creation, snapshots, quote drift, retry, stock and fulfillment. The isolated HTTP
harness uses a test ingress secret and signed fixture requests; this is not a
public test-country header and does not enable a production override. Without
signed fixture requests the harness also returns the neutral unavailable state.
