# S7Plus TLS and Security

## Overview

S7Plus connections can be encrypted with TLS (Transport Layer Security). This is important in environments where network security is relevant.

## TLS Configuration

### Enabling TLS

On the connection datapoint:
```
Config.UseTls            = true
Config.Certificate       = "my_plc_cert.pem"    (optional: server certificate)
Config.LegitimationLevel = 0                     (set automatically)
```

### Prerequisites

Before creating a TLS connection:

1. **At least one CA certificate** must be in the trust list (`_S7PlusConfig.CaCertificates`)
2. **Certificate files** must be located in the certificate directory of the WinCC OA project (`data/s7plus/cert`)

### Legitimation Level

The `Config.UseTls` parameter is internally mapped to `Config.LegitimationLevel`:
- `UseTls = true` -> LegitimationLevel = 0 (Failsafe)
- `UseTls = false` -> LegitimationLevel = -1 (Invalid)

The LegitimationLevel enum has additional values (Full=1, ReadWrite=2, ReadOnly=3, InactiveAccess=4) for PLC access permissions. See the configuration values document.

## CA Certificate Management

CA certificates are stored in `_S7PlusConfig.CaCertificates` — the root trust list that applies **to all S7Plus connections** in the project.

### Actions

| Action | Description |
|--------|-------------|
| List | Read `_S7PlusConfig.CaCertificates` |
| Add | Add file names to the `CaCertificates` list (duplicates are skipped) |
| Remove | Remove file names from the `CaCertificates` list |

Certificate files must be present in the `data/s7plus/cert` directory of the WinCC OA project.

## Certificate Types

| Certificate | Location | Purpose |
|------------|----------|---------|
| **CA Certificate** | `_S7PlusConfig.CaCertificates` | Root trust list — validates the identity of the PLC. Applies to all connections. |
| **Server Certificate** | `Config.Certificate` (per connection) | Specific certificate file for this connection. Optional. |

There is no client certificate verification — the PLC does not verify the WinCC OA client.

## TLS Setup Workflow

```
1. Copy certificate files to data/s7plus/cert

2. Add CA certificates to the trust list:
   _S7PlusConfig.CaCertificates = ["root_ca.pem"]

3. Create connection with TLS:
   Config.Address   = "192.168.1.100"
   Config.PLCType   = 16
   Config.UseTls    = true
   Config.Certificate = "plc_cert.pem"   (optional)

4. Activate connection and check status:
   State.ConnState = 3 (Connected)
```

## PLC Password Protection

In addition to TLS, PLCs can require a password for access:

```
Config.Password = "myPLCpassword"
```

The password is independent of TLS — both can be used individually or in combination.

## Security Best Practices

- Use TLS for all production connections, especially across network boundaries
- Rotate CA certificates before expiration
- Use separate server certificates per connection
- Combine TLS with PLC password protection (defense in depth)
- Monitor connection status for unexpected `Failure` states (may indicate certificate issues)
