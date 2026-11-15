# MCP registry identity

Prepared on 15 November 2026 for `com.tenhaw/kit`. The private Ed25519 seed is stored only in the protected `release` environment of `Tenhaw/tenhaw-kit` as `MCP_PRIVATE_KEY`. The session temporary private seed file was removed after the protected environment secret was confirmed. No private key is committed or printed.

## Public HTTP proof

Serve this exact public record at `https://tenhaw.com/.well-known/mcp-registry-auth`:

```text
v=MCPv1; k=ed25519; p=yO4AwlKoGP0TRVBq6G/awF55boBGvmo6qt1/c3Vbi7E=
```

The endpoint must return 200 directly, with `Content-Type: text/plain; charset=utf-8`, under 4096 bytes, within 10 seconds. The registry does not follow redirects. Its request uses `Accept: text/plain` and `User-Agent: mcp-registry/1.0`. The proof is public verification material; it does not contain the private signing seed.

The public endpoint was verified live on 15 November 2026: direct HTTP 200, no Location redirect, `text/plain; charset=utf-8`, 66 bytes and the exact expected public key. Repository variable `MCP_HTTP_AUTH_CONFIGURED=true` was then set and read back successfully. `registry-publish.yml` requires that flag and independently checks that the live proof matches its protected signing seed. It then authenticates using the pinned official publisher's `login http --domain tenhaw.com --private-key <64 hex seed>` interface. No registry publication has happened merely because the key and workflow are prepared.

[Official HTTP authentication requirements](https://modelcontextprotocol.io/registry/authentication#http-authentication) and [pinned v1.8.9 CLI implementation](https://github.com/modelcontextprotocol/registry/blob/v1.8.9/cmd/publisher/commands/login.go).

## Service DNS

Authoritative nameservers remain `ns19.domaincontrol.com` and `ns20.domaincontrol.com` at GoDaddy. Vercel's DNS zone is not authoritative for this domain. No nameserver, apex, email or other existing record is changed.

Both service domains are attached to their intended Vercel projects and ownership-verified. Vercel returned these exact preferred CNAME targets after attachment:

| GoDaddy type | Name | Value |
| --- | --- | --- |
| CNAME | `kit` | `58e2ed1e96aa60f0.vercel-dns-016.com` |
| CNAME | `mcp` | `1ed4a8bd5c51a680.vercel-dns-016.com` |

Use the provider's default TTL, or 600 seconds. Add only these two subdomain records. The MCP identity uses HTTP proof, so no apex TXT record is needed. DNS propagation, TLS readiness and live responses must be verified separately after GoDaddy records are saved.
