# Resend DNS records for utahdrops.com

Added to Resend 2026-06-13 (domain id de936e9e-e178-4986-9172-df5727b3bde3, region us-east-1).
Enter these at Spaceship DNS. "Host"/Name is the subdomain part only — Spaceship appends utahdrops.com.

## Sending (required)

| Type | Host                | Value                                                                 | Priority |
|------|---------------------|-----------------------------------------------------------------------|----------|
| TXT  | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDbhx0tMjAyV8lD0N4YW3Y2chL2kEvibEFsXGc49hv6WEuYpnt5r1vC5BDh6JFLsrIj6dMyEtmvB8/WkbljpQhG2kfTrcqJCLU2dLMgmeMbr2JSB6kfLCTHHVGG+2G5+MK7SDgD0h8PrhplKT4A0nrUzrYDkCxJOw03wE8KP5MivQIDAQAB` | — |
| MX   | `send`              | `feedback-smtp.us-east-1.amazonses.com`                               | 10       |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                                   | —        |

## Deliverability (recommended)

| Type | Host     | Value               |
|------|----------|---------------------|
| TXT  | `_dmarc` | `v=DMARC1; p=none;` |

## Skipped — receiving (not needed; Utah Drops only sends)

- MX `@` → `inbound-smtp.us-east-1.amazonaws.com` (priority 10) — only needed to *receive* email at utahdrops.com. Skip to avoid putting an MX on the root domain.
