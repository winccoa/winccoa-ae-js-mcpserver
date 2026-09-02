# Third-Party Software Information

Note to Resellers: Please pass on this document to your customer to avoid license infringements.

This product, solution or service ("Product") contains third-party software components listed in this document. These components are Open Source Software licensed under a license approved by the Open Source Initiative (www.opensource.org) or similar licenses as determined by SIEMENS ("OSS") and/or commercial or freeware software components. With respect to the OSS components, the applicable OSS license conditions prevail over any other terms and conditions covering the Product. The OSS portions of this Product are provided royalty-free and can be used at no charge.

If SIEMENS has combined or linked certain components of the Product with/to OSS components licensed under the GNU LGPL version 2 or later as per the definition of the applicable license, and if use of the corresponding object file is not unrestricted ("LGPL Licensed Module", whereas the LGPL Licensed Module and the components that the LGPL Licensed Module is combined with or linked to is the "Combined Product"), the following additional rights apply, if the relevant LGPL license criteria are met: (i) you are entitled to modify the Combined Product for your own use, including but not limited to the right to modify the Combined Product to relink modified versions of the LGPL Licensed Module, and (ii) you may reverse-engineer the Combined Product, but only to debug your modifications. The modification right does not include the right to distribute such modifications and you shall maintain in confidence any information resulting from such reverse-engineering of a Combined Product.

Certain OSS licenses require SIEMENS to make source code available, for example, the GNU General Public License, the GNU Lesser General Public License and the Mozilla Public License. If such licenses are applicable and this Product is not shipped with the required source code, a copy of this source code can be obtained by anyone in receipt of this information during the period required by the applicable OSS licenses by contacting the following address:

Siemens AG  
LC TEC IT&SL  
Werner-von-Siemens Str. 60  
91052 Erlangen  
Germany

Keyword: Open Source Request (please specify Product name and version, if applicable)

SIEMENS may charge a handling fee of up to 5 EUR to fulfil the request.

## Warranty regarding further use of the Open Source Software

SIEMENS' warranty obligations are set forth in your agreement with SIEMENS. SIEMENS does not provide any warranty or technical support for this Product or any OSS components contained in it if they are modified or used in any manner not specified by SIEMENS. The license conditions listed below may contain disclaimers that apply between you and the respective licensor. For the avoidance of doubt, SIEMENS does not make any warranty commitment on behalf of or binding upon any third party licensor.

## Open Source Software and/or other third-party software contained in this Product:

Please note the following license conditions and copyright notices applicable to Open Source Software and/or other components (or parts thereof):

### Direct runtime dependencies

The components the MCP server declares directly, with notes. All versions are pinned exactly in
`mcpWinCCOA/package.json`. **The complete list of every distributed component is further below**; a
machine-readable CycloneDX SBOM (`sbom.json`) is published with each release.

| Component | Open Source Software [Yes/No] | Acknowledgements/Comment | License conditions and copyright notices |
|-----------|------------------------------|-------------------------|----------------------------------------|
| @modelcontextprotocol/sdk 1.30.0 | Yes | Model Context Protocol server/client SDK. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. Pinned above the advisory range 1.10.0-1.25.3 (cross-client data leak via shared server/transport instance reuse). | [MIT](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/LICENSE) |
| cors 2.8.6 | Yes | Express CORS middleware. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. | [MIT](https://github.com/expressjs/cors/blob/master/LICENSE) |
| dotenv 16.6.1 | Yes | Loads `.env` configuration. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. | [BSD-2-Clause](https://github.com/motdotla/dotenv/blob/master/LICENSE) |
| express 5.2.1 | Yes | HTTP server for the streamable HTTP transport. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. | [MIT](https://github.com/expressjs/express/blob/master/LICENSE) |
| express-rate-limit 7.5.1 | Yes | Request rate limiting. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. | [MIT](https://github.com/express-rate-limit/express-rate-limit/blob/main/LICENSE) |
| mcp-remote 0.1.37 | Yes | Remote MCP client bridge. Under Siemens vulnerability monitoring as of 2026-09-01. The pinned 0.1.37 is **not affected** by the known Remote Command Injection vulnerability in versions 0.0.5 to 0.1.15, which was fixed in 0.1.16. | [MIT](https://github.com/geelen/mcp-remote/blob/main/LICENSE) |
| zod 3.25.76 | Yes | Runtime schema validation for tool inputs. Under Siemens vulnerability monitoring as of 2026-09-01; no known vulnerabilities. | [MIT](https://github.com/colinhacks/zod/blob/main/LICENSE) |

### Not distributed

| Component | Open Source Software [Yes/No] | Acknowledgements/Comment | License conditions and copyright notices |
|-----------|------------------------------|-------------------------|----------------------------------------|
| winccoa-manager | No | Proprietary Siemens component, supplied by the WinCC OA installation and declared as an optional `peerDependency`. It is **never** bundled or redistributed with this package, and is excluded from `sbom.json` via `--omit peer`. | Covered by the WinCC OA license terms |

### Build-time only (not distributed)

Development dependencies are not part of the delivered artifact and are excluded from `sbom.json`
(`--omit dev`). Listed for completeness: `@cyclonedx/cyclonedx-npm` 6.0.1 (Apache-2.0), `typescript`
5.9.3 (Apache-2.0), `vitest` 4.1.11 (MIT), `@vitest/coverage-v8` 4.1.11 (MIT), `@types/node` 20.19.43
(MIT), `@types/express` 5.0.6 (MIT).

<!-- BEGIN GENERATED COMPONENT LIST - edit gen-oss.mjs, not this block -->

**111 components** are distributed with this product. Generated from `sbom.json`; regenerate with `npm run oss`.

Licence summary: MIT (100), ISC (7), BSD-2-Clause (2), BSD-3-Clause (2). All are permissive attribution licences; none are copyleft.

| Component | Version | Licence | Direct dependency |
|-----------|---------|---------|-------------------|
| @hono/node-server | 2.1.1 | [MIT](https://opensource.org/license/mit) | no |
| @modelcontextprotocol/sdk | 1.30.0 | [MIT](https://opensource.org/license/mit) | yes |
| accepts | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| ajv | 8.20.0 | [MIT](https://opensource.org/license/mit) | no |
| ajv-formats | 3.0.1 | [MIT](https://opensource.org/license/mit) | no |
| array-flatten | 1.1.1 | [MIT](https://opensource.org/license/mit) | no |
| body-parser | 2.3.0 | [MIT](https://opensource.org/license/mit) | no |
| bundle-name | 4.1.0 | [MIT](https://opensource.org/license/mit) | no |
| bytes | 3.1.2 | [MIT](https://opensource.org/license/mit) | no |
| call-bind-apply-helpers | 1.0.2 | [MIT](https://opensource.org/license/mit) | no |
| call-bound | 1.0.4 | [MIT](https://opensource.org/license/mit) | no |
| content-disposition | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| content-type | 1.0.5 | [MIT](https://opensource.org/license/mit) | no |
| cookie | 0.7.2 | [MIT](https://opensource.org/license/mit) | no |
| cookie-signature | 1.2.2 | [MIT](https://opensource.org/license/mit) | no |
| cors | 2.8.6 | [MIT](https://opensource.org/license/mit) | yes |
| cross-spawn | 7.0.6 | [MIT](https://opensource.org/license/mit) | no |
| debug | 4.4.3 | [MIT](https://opensource.org/license/mit) | no |
| default-browser | 5.4.0 | [MIT](https://opensource.org/license/mit) | no |
| default-browser-id | 5.0.1 | [MIT](https://opensource.org/license/mit) | no |
| define-lazy-prop | 3.0.0 | [MIT](https://opensource.org/license/mit) | no |
| depd | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| destroy | 1.2.0 | [MIT](https://opensource.org/license/mit) | no |
| dotenv | 16.6.1 | [BSD-2-Clause](https://opensource.org/license/bsd-2-clause) | yes |
| dunder-proto | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| ee-first | 1.1.1 | [MIT](https://opensource.org/license/mit) | no |
| encodeurl | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| es-define-property | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| es-errors | 1.3.0 | [MIT](https://opensource.org/license/mit) | no |
| es-object-atoms | 1.1.1 | [MIT](https://opensource.org/license/mit) | no |
| escape-html | 1.0.3 | [MIT](https://opensource.org/license/mit) | no |
| etag | 1.8.1 | [MIT](https://opensource.org/license/mit) | no |
| eventsource | 3.0.7 | [MIT](https://opensource.org/license/mit) | no |
| eventsource-parser | 3.0.6 | [MIT](https://opensource.org/license/mit) | no |
| express | 5.2.1 | [MIT](https://opensource.org/license/mit) | yes |
| express-rate-limit | 7.5.1 | [MIT](https://opensource.org/license/mit) | yes |
| fast-deep-equal | 3.1.3 | [MIT](https://opensource.org/license/mit) | no |
| fast-uri | 3.1.6 | [BSD-3-Clause](https://opensource.org/license/bsd-3-clause) | no |
| finalhandler | 2.1.1 | [MIT](https://opensource.org/license/mit) | no |
| forwarded | 0.2.0 | [MIT](https://opensource.org/license/mit) | no |
| fresh | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| function-bind | 1.1.2 | [MIT](https://opensource.org/license/mit) | no |
| get-intrinsic | 1.3.0 | [MIT](https://opensource.org/license/mit) | no |
| get-proto | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| gopd | 1.2.0 | [MIT](https://opensource.org/license/mit) | no |
| has-symbols | 1.1.0 | [MIT](https://opensource.org/license/mit) | no |
| hasown | 2.0.2 | [MIT](https://opensource.org/license/mit) | no |
| hono | 4.13.5 | [MIT](https://opensource.org/license/mit) | no |
| http-errors | 2.0.1 | [MIT](https://opensource.org/license/mit) | no |
| iconv-lite | 0.7.2 | [MIT](https://opensource.org/license/mit) | no |
| inherits | 2.0.4 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| ip-address | 10.7.0 | [MIT](https://opensource.org/license/mit) | no |
| ipaddr.js | 1.9.1 | [MIT](https://opensource.org/license/mit) | no |
| is-docker | 3.0.0 | [MIT](https://opensource.org/license/mit) | no |
| is-inside-container | 1.0.0 | [MIT](https://opensource.org/license/mit) | no |
| is-promise | 4.0.0 | [MIT](https://opensource.org/license/mit) | no |
| is-wsl | 3.1.0 | [MIT](https://opensource.org/license/mit) | no |
| isexe | 2.0.0 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| jose | 6.1.3 | [MIT](https://opensource.org/license/mit) | no |
| json-schema-traverse | 1.0.0 | [MIT](https://opensource.org/license/mit) | no |
| json-schema-typed | 8.0.2 | [BSD-2-Clause](https://opensource.org/license/bsd-2-clause) | no |
| math-intrinsics | 1.1.0 | [MIT](https://opensource.org/license/mit) | no |
| mcp-remote | 0.1.37 | [MIT](https://opensource.org/license/mit) | yes |
| media-typer | 1.1.0 | [MIT](https://opensource.org/license/mit) | no |
| merge-descriptors | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| methods | 1.1.2 | [MIT](https://opensource.org/license/mit) | no |
| mime | 1.6.0 | [MIT](https://opensource.org/license/mit) | no |
| mime-db | 1.54.0 | [MIT](https://opensource.org/license/mit) | no |
| mime-types | 3.0.2 | [MIT](https://opensource.org/license/mit) | no |
| ms | 2.1.3 | [MIT](https://opensource.org/license/mit) | no |
| negotiator | 1.0.0 | [MIT](https://opensource.org/license/mit) | no |
| object-assign | 4.1.1 | [MIT](https://opensource.org/license/mit) | no |
| object-inspect | 1.13.4 | [MIT](https://opensource.org/license/mit) | no |
| on-finished | 2.4.1 | [MIT](https://opensource.org/license/mit) | no |
| once | 1.4.0 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| open | 10.2.0 | [MIT](https://opensource.org/license/mit) | no |
| parseurl | 1.3.3 | [MIT](https://opensource.org/license/mit) | no |
| path-key | 3.1.1 | [MIT](https://opensource.org/license/mit) | no |
| path-to-regexp | 8.4.2 | [MIT](https://opensource.org/license/mit) | no |
| pkce-challenge | 5.0.1 | [MIT](https://opensource.org/license/mit) | no |
| proxy-addr | 2.0.7 | [MIT](https://opensource.org/license/mit) | no |
| qs | 6.15.3 | [BSD-3-Clause](https://opensource.org/license/bsd-3-clause) | no |
| range-parser | 1.2.1 | [MIT](https://opensource.org/license/mit) | no |
| raw-body | 3.0.2 | [MIT](https://opensource.org/license/mit) | no |
| require-from-string | 2.0.2 | [MIT](https://opensource.org/license/mit) | no |
| router | 2.2.0 | [MIT](https://opensource.org/license/mit) | no |
| run-applescript | 7.1.0 | [MIT](https://opensource.org/license/mit) | no |
| safe-buffer | 5.2.1 | [MIT](https://opensource.org/license/mit) | no |
| safer-buffer | 2.1.2 | [MIT](https://opensource.org/license/mit) | no |
| send | 1.2.1 | [MIT](https://opensource.org/license/mit) | no |
| serve-static | 2.2.1 | [MIT](https://opensource.org/license/mit) | no |
| setprototypeof | 1.2.0 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| shebang-command | 2.0.0 | [MIT](https://opensource.org/license/mit) | no |
| shebang-regex | 3.0.0 | [MIT](https://opensource.org/license/mit) | no |
| side-channel | 1.1.1 | [MIT](https://opensource.org/license/mit) | no |
| side-channel-list | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| side-channel-map | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| side-channel-weakmap | 1.0.2 | [MIT](https://opensource.org/license/mit) | no |
| statuses | 2.0.2 | [MIT](https://opensource.org/license/mit) | no |
| strict-url-sanitise | 0.0.1 | [MIT](https://opensource.org/license/mit) | no |
| toidentifier | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| type-is | 2.1.0 | [MIT](https://opensource.org/license/mit) | no |
| undici | 7.29.0 | [MIT](https://opensource.org/license/mit) | no |
| unpipe | 1.0.0 | [MIT](https://opensource.org/license/mit) | no |
| utils-merge | 1.0.1 | [MIT](https://opensource.org/license/mit) | no |
| vary | 1.1.2 | [MIT](https://opensource.org/license/mit) | no |
| which | 2.0.2 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| wrappy | 1.0.2 | [ISC](https://opensource.org/license/isc-license-txt) | no |
| wsl-utils | 0.1.0 | [MIT](https://opensource.org/license/mit) | no |
| zod | 3.25.76 | [MIT](https://opensource.org/license/mit) | yes |
| zod-to-json-schema | 3.25.1 | [ISC](https://opensource.org/license/isc-license-txt) | no |

<!-- END GENERATED COMPONENT LIST -->
