# Security Policy

The WinCC OA MCP Server connects AI assistants to WinCC OA SCADA systems, so we take its security
seriously. If you think you have found a security vulnerability, please read this page before
reporting it.

## Supported versions

Only the latest release receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.5.x (latest release) | ✅ |
| < 1.5 | ❌ |

Fixes are released as a new patch or minor version, not backported to older lines. As stated in
[LEGAL_INFO.md](LEGAL_INFO.md), apply updates as soon as they are available and use the latest
version: running a version that is no longer supported may increase your exposure to cyber threats.
The [CHANGELOG](CHANGELOG.md) lists the security fixes in each release.

## Reporting a vulnerability

Report vulnerabilities **only** to Siemens ProductCERT:

- Email: [productcert@siemens.com](mailto:productcert@siemens.com)
- Website: <https://productcert.siemens.com/>

Please name this project ("WinCC OA MCP Server", `winccoa/winccoa-ae-js-mcpserver`) in your report.
Encrypted email is preferred: the ProductCERT PGP public key is published at
<https://productcert.siemens.com/> (fingerprint `580D 38DA 2285 55EB 2A39 9A81 18BA BD55 427E CF78`).

**Please do not open public GitHub issues, discussions or pull requests for vulnerabilities, and do
not contact the maintainers directly.** A public report puts every installation at risk before a fix is
available, and only ProductCERT can handle the reporting obligations that apply to Siemens products.

### What to include

- The affected version (`serverInfo` version, npm package version or SIOS archive version) and how it
  is installed (npm or SIOS archive), plus the Node.js and WinCC OA versions.
- The transport and client (HTTP or stdio; TLS on or off; Claude Desktop with `mcp-remote`, Claude
  Code, another client) and the relevant, **redacted** `.env` settings. Never send real tokens,
  passwords or certificates.
- A description of the issue and its impact, and the steps or a minimal proof of concept to
  reproduce it.
- If you have one, a suggested fix or mitigation.
- Whether and how you would like to be credited.

### What happens next

ProductCERT coordinates the handling of your report. For what to expect, see the information published
on <https://productcert.siemens.com/>.

## Scope

**In scope:** the code in this repository and what it distributes: the MCP server (HTTP and stdio
transports, authentication, the tools and their input validation), its build and release scripts, and
the configuration and security guidance in its documentation.

**Third-party components:** this server depends on open-source packages (listed in [OSS.md](OSS.md),
with a CycloneDX SBOM published with each release). The client configuration examples use
[`mcp-remote`](https://github.com/geelen/mcp-remote), a separate third-party bridge that runs on the
client machine. If a vulnerability is in such a component, please **report it to its upstream
project** as well, and send any impact on this server to Siemens ProductCERT, for example if it affects how
this server is used or what our documentation recommends — for example, the known `mcp-remote` OAuth-discovery issues are described in the
[`mcp-remote` security note](README.md#mcp-remote-security-note).

**Out of scope:** WinCC OA itself and other Siemens products (report those to Siemens ProductCERT,
<https://productcert.siemens.com/>), AI clients and models, and installations that ignore the documented
security guidance (for example, plain HTTP across an untrusted network).
