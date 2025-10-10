# OPC UA Address Config Guide

Complete step-by-step instructions for creating and configuring an OPC UA Address Config in WinCC OA.

## Overview

An **Address Config** in WinCC OA defines the connection settings and communication parameters for external systems. For OPC UA (Open Platform Communications Unified Architecture), the Address Config establishes the connection to an OPC UA server and defines how data points are mapped to OPC UA nodes.

## Prerequisites

Before creating an OPC UA Address Config, ensure:

- **WinCC OA 3.20** or higher is installed
- **OPC UA Driver** is available in your WinCC OA installation
- You have access to the **GEDI** (WinCC OA Editor)
- You know the **OPC UA Server endpoint URL** (e.g., `opc.tcp://servername:4840`)
- You have **credentials** if the OPC UA server requires authentication
- **System Management** permissions in WinCC OA

## Step 1: Open System Management

### 1.1 Launch GEDI

1. Start **WinCC OA GEDI** (WinCC OA Editor)
2. Open your project if not already loaded

### 1.2 Access System Management

1. Click on the **Para** button in the top menu bar
2. Select **System Management** from the dropdown menu
3. Alternatively, use the keyboard shortcut (typically `Ctrl + P`)

The System Management panel will open, showing the project configuration tree.

## Step 2: Navigate to Drivers Section

### 2.1 Locate OPC UA Driver

1. In the **System Management** tree view, expand the **dist** (Distribution) section
2. Navigate to **Drivers**
3. Look for the **OPC UA Client** driver entry

**Note:** If the OPC UA Client driver is not visible, you may need to:
- Install the OPC UA driver package for WinCC OA
- Check your WinCC OA license includes OPC UA support
- Contact your system administrator

## Step 3: Create New Address Config

### 3.1 Add Address Configuration

1. Right-click on **OPC UA Client** in the driver tree
2. Select **Insert → Address**
3. A new Address Config dialog will appear

### 3.2 Configure Basic Settings

In the **Address Config** dialog, configure the following:

#### General Settings

**Address Name:**
- Enter a descriptive name for this configuration
- Example: `OPC_Plant_Server` or `OPC_Production_Line1`
- Use meaningful names that identify the server or system

**Driver Number:**
- Usually assigned automatically
- Ensure it's unique within your project
- Typical format: `1`, `2`, `3`, etc.

**Active:**
- Check this box to enable the address configuration
- Uncheck for testing or maintenance without deleting

## Step 4: Configure OPC UA Connection

### 4.1 Server Connection Settings

**Endpoint URL:**
```
opc.tcp://hostname:port/path
```

**Examples:**
- Local server: `opc.tcp://localhost:4840`
- Remote server: `opc.tcp://192.168.1.100:4840/UAServer`
- Named server: `opc.tcp://plc-server-01.company.local:4840`

**Important Notes:**
- Use `opc.tcp://` protocol prefix (not http://)
- Default OPC UA port is typically `4840`
- Port may vary depending on server configuration
- Include the complete path if specified by the server

### 4.2 Security Settings

**Security Mode:**

Select the appropriate security mode based on your OPC UA server requirements:

1. **None** - No security (testing only, not recommended for production)
2. **Sign** - Messages are signed for integrity
3. **SignAndEncrypt** - Messages are signed and encrypted (recommended for production)

**Security Policy:**

Common options include:
- **None** - No security policy
- **Basic128Rsa15** - Basic 128-bit encryption (legacy)
- **Basic256** - 256-bit encryption (legacy)
- **Basic256Sha256** - 256-bit with SHA256 (recommended)
- **Aes128_Sha256_RsaOaep** - AES 128-bit (modern)
- **Aes256_Sha256_RsaPss** - AES 256-bit (most secure)

**Authentication:**

Choose the authentication method:

1. **Anonymous** - No authentication required
   - No username/password needed
   - Only for development or testing

2. **Username/Password**
   - Enter valid credentials
   - Username: `operator`, `admin`, etc.
   - Password: Enter securely (will be encrypted)

3. **Certificate**
   - Requires client certificate configuration
   - Certificate path: `/path/to/client-cert.der`
   - Private key path: `/path/to/private-key.pem`

### 4.3 Advanced Connection Settings

**Session Settings:**

**Timeout (ms):**
- Connection timeout in milliseconds
- Default: `5000` (5 seconds)
- Increase for slow networks or remote servers
- Range: 1000-60000 ms

**Keep Alive Interval (ms):**
- Heartbeat interval to maintain connection
- Default: `10000` (10 seconds)
- Adjust based on network stability

**Reconnect Settings:**

**Auto Reconnect:**
- Enable automatic reconnection on connection loss
- Recommended: **Enabled** for production systems

**Reconnect Interval (seconds):**
- Time between reconnection attempts
- Default: `10` seconds
- Adjust based on server availability

**Max Reconnect Attempts:**
- Maximum number of reconnection tries
- `0` = infinite attempts (recommended for production)
- Positive number = limited attempts

## Step 5: Configure Subscription Settings

### 5.1 Publishing Interval

**Publishing Interval (ms):**
- How often the OPC UA server publishes data changes
- Default: `1000` (1 second)
- Lower values = faster updates, higher network load
- Typical range: 100-5000 ms

**Examples by Application:**
- Fast process control: `100-250 ms`
- Standard monitoring: `500-1000 ms`
- Slow processes: `2000-5000 ms`

### 5.2 Data Monitoring

**Sampling Interval (ms):**
- How often the server samples values
- Should be ≤ Publishing Interval
- Default: `1000` (1 second)

**Queue Size:**
- Number of value changes buffered
- Default: `10`
- Increase for high-frequency data or slow networks

**Discard Oldest:**
- When queue is full, discard oldest or newest value
- Recommended: **Enabled** (discard oldest)

## Step 6: Configure Namespace Mapping

### 6.1 Understanding Namespaces

OPC UA uses namespaces to organize nodes. Common namespaces:
- `ns=0` - OPC UA standard namespace
- `ns=1` - Server-specific namespace
- `ns=2+` - Application-specific namespaces

### 6.2 Set Default Namespace

**Default Namespace Index:**
- Enter the namespace index for your datapoints
- Typically `2` for application data
- Check with your OPC UA server documentation

**Examples:**
```
ns=2;s=Temperature.Reactor1
ns=2;i=1234
ns=3;s=Production.Line1.Speed
```

## Step 7: Test Connection

### 7.1 Verify Configuration

Before saving, verify all settings:

- [ ] Endpoint URL is correct and reachable
- [ ] Security settings match server requirements
- [ ] Authentication credentials are valid
- [ ] Timeout values are appropriate
- [ ] Subscription settings are suitable for your application

### 7.2 Save Configuration

1. Click **OK** to save the Address Config
2. The configuration will be added to the project

### 7.3 Test Connection

**Method 1: Use System Management**
1. Select the new Address Config in the tree
2. Right-click and choose **Test Connection**
3. Check the result message

**Method 2: Start Driver Manager**
1. In System Management, right-click the Address Config
2. Select **Start Driver Manager**
3. Monitor the WinCC OA Log Viewer for connection messages

**Expected Success Messages:**
```
OPC UA Client [1]: Connected to opc.tcp://server:4840
OPC UA Client [1]: Session established
OPC UA Client [1]: Subscription created
```

**Common Error Messages:**

**"Connection timeout"**
- Verify server URL and port
- Check network connectivity
- Ensure firewall allows OPC UA traffic

**"Bad Certificate"**
- Check certificate paths
- Verify certificate validity
- Ensure server trusts client certificate

**"Bad User Access Denied"**
- Verify username and password
- Check user permissions on server
- Ensure authentication method is correct

## Step 8: Create Data Point Elements

### 8.1 Define Datapoint Type

After the Address Config is created, you need to create datapoint elements that reference OPC UA nodes.

**In GEDI:**
1. Open **Para → Datapoints**
2. Create or edit a datapoint
3. Add elements with OPC UA address references

### 8.2 Configure Address Reference

For each datapoint element:

**Address Type:** `OPC UA`

**Address Reference:**
```
[DriverNumber]:[NodeId]
```

**Examples:**
```
1:ns=2;s=Temperature.Reactor1
1:ns=2;i=5001
2:ns=3;s=Production.Line1.Speed
```

**Components:**
- `1:` - Driver number (from Address Config)
- `ns=2;` - Namespace index
- `s=` - String identifier (or `i=` for integer, `g=` for GUID)
- `Temperature.Reactor1` - Node identifier

### 8.3 Configure Polling

**Direction:**
- **Input (I)** - Read from OPC UA server
- **Output (O)** - Write to OPC UA server
- **Input/Output (I/O)** - Both read and write

**Smoothing:**
- Enable for analog values to reduce noise
- Typically disabled for digital values

**Deadband:**
- Minimum change required to trigger update
- Reduces unnecessary updates
- Example: `0.1` for ±0.1 unit changes

## Step 9: Configure Redundancy (Optional)

### 9.1 For High Availability

If you need redundant OPC UA connections:

1. Create a second Address Config for the backup server
2. Use different driver numbers
3. Configure failover settings in WinCC OA redundancy manager

### 9.2 Redundancy Settings

**Primary Server:**
- Address Config 1 with priority 1

**Secondary Server:**
- Address Config 2 with priority 2
- Same node IDs as primary
- Automatic switchover on connection loss

## Step 10: Monitor and Maintain

### 10.1 Monitor Connection Status

**Using Para Module:**
1. Open **Para → System Management**
2. Check driver status (green = active, red = error)
3. View statistics (data rate, errors, reconnections)

**Using Log Viewer:**
1. Open WinCC OA Log Viewer
2. Filter by "OPC UA" or driver number
3. Monitor connection events and errors

### 10.2 Performance Monitoring

**Key Metrics:**
- **Connection uptime** - Should be close to 100%
- **Data update rate** - Should match configured intervals
- **Error count** - Should be minimal
- **Latency** - Time from server change to WinCC OA update

### 10.3 Regular Maintenance

**Weekly:**
- Check log files for errors or warnings
- Verify connection stability
- Review data quality indicators

**Monthly:**
- Update security certificates if needed
- Review and optimize subscription intervals
- Check for OPC UA server updates

**Quarterly:**
- Test failover scenarios
- Verify backup configurations
- Update documentation

## Troubleshooting

### Connection Issues

**Problem: Cannot connect to server**

**Solutions:**
1. Verify server is running: `ping hostname`
2. Check port accessibility: `telnet hostname 4840`
3. Verify firewall rules allow OPC UA traffic
4. Check server logs for rejected connections
5. Ensure correct endpoint URL format

**Problem: Connection drops frequently**

**Solutions:**
1. Increase Keep Alive Interval
2. Check network stability
3. Verify server capacity
4. Increase timeout values
5. Enable auto-reconnect if not already active

### Authentication Issues

**Problem: "Bad User Access Denied"**

**Solutions:**
1. Verify username and password are correct
2. Check user exists on OPC UA server
3. Verify user has sufficient permissions
4. Ensure authentication mode matches server requirements
5. Check for expired passwords

**Problem: "Bad Certificate"**

**Solutions:**
1. Verify certificate paths are correct
2. Check certificate is not expired
3. Ensure certificate format is correct (DER/PEM)
4. Trust client certificate on server
5. Check certificate chain is complete

### Data Issues

**Problem: No data updates**

**Solutions:**
1. Verify datapoint address references are correct
2. Check node IDs exist on server
3. Ensure subscription is active
4. Verify data direction (Input/Output)
5. Check node access rights

**Problem: Slow data updates**

**Solutions:**
1. Reduce Publishing Interval
2. Reduce Sampling Interval
3. Check network latency
4. Optimize number of monitored items
5. Consider using data change filters

### Performance Issues

**Problem: High CPU usage**

**Solutions:**
1. Increase Publishing Interval to reduce update frequency
2. Reduce number of monitored items
3. Optimize subscription settings
4. Check for unnecessary data polling
5. Review server performance

**Problem: High network traffic**

**Solutions:**
1. Increase Publishing Interval
2. Use appropriate deadband settings
3. Enable data change filters
4. Reduce queue sizes
5. Optimize sampling intervals

## Best Practices

### Security

1. **Always use encryption in production**
   - Minimum: SignAndEncrypt with Basic256Sha256
   - Preferred: Aes256_Sha256_RsaPss for sensitive data

2. **Use strong authentication**
   - Avoid anonymous access in production
   - Use certificate-based authentication when possible
   - Change default passwords

3. **Certificate management**
   - Use proper certificate authority
   - Monitor expiration dates
   - Have renewal process in place
   - Store private keys securely

### Performance

1. **Optimize subscription intervals**
   - Don't update faster than necessary
   - Group similar update rates together
   - Consider data importance vs. network load

2. **Use appropriate queue sizes**
   - Small queues for real-time critical data
   - Larger queues for historical/trending data
   - Monitor for queue overflows

3. **Implement deadbands**
   - Reduce unnecessary updates for analog values
   - Typical values: 0.1-1% of range
   - Adjust based on process characteristics

### Reliability

1. **Enable auto-reconnect**
   - Essential for production systems
   - Set reasonable retry intervals
   - Monitor reconnection events

2. **Configure redundancy**
   - Use redundant servers for critical systems
   - Test failover regularly
   - Document failover procedures

3. **Monitor and alert**
   - Set up connection status monitoring
   - Configure alerts for connection loss
   - Log important events for troubleshooting

### Documentation

1. **Document your configuration**
   - Server endpoints and credentials
   - Namespace mappings
   - Node ID conventions
   - Special configurations

2. **Maintain change history**
   - Track configuration changes
   - Document reasons for changes
   - Note impacts on system

3. **Create runbooks**
   - Troubleshooting procedures
   - Failover procedures
   - Maintenance schedules

## Example Configurations

### Example 1: Local Development Server

```
Address Name: OPC_Dev_Server
Endpoint: opc.tcp://localhost:4840
Security Mode: None
Security Policy: None
Authentication: Anonymous
Publishing Interval: 1000 ms
Timeout: 5000 ms
Auto Reconnect: Enabled
```

**Use Case:** Development and testing, local machine

### Example 2: Production PLC Server

```
Address Name: OPC_PLC_Line1
Endpoint: opc.tcp://plc01.factory.local:4840
Security Mode: SignAndEncrypt
Security Policy: Basic256Sha256
Authentication: Username/Password
  Username: winccoa_client
  Password: ********
Publishing Interval: 500 ms
Timeout: 10000 ms
Auto Reconnect: Enabled
Reconnect Interval: 10 seconds
Keep Alive: 10000 ms
```

**Use Case:** Production line monitoring, medium security

### Example 3: Critical Infrastructure Server

```
Address Name: OPC_Critical_System
Endpoint: opc.tcp://critical-server.company.local:4840
Security Mode: SignAndEncrypt
Security Policy: Aes256_Sha256_RsaPss
Authentication: Certificate
  Client Cert: /opt/certs/winccoa-client.der
  Private Key: /opt/certs/winccoa-client.key
Publishing Interval: 250 ms
Timeout: 15000 ms
Auto Reconnect: Enabled
Reconnect Interval: 5 seconds
Keep Alive: 5000 ms
Max Reconnect: 0 (infinite)
```

**Use Case:** Critical infrastructure, high security requirements

### Example 4: Remote Cloud Server

```
Address Name: OPC_Cloud_Gateway
Endpoint: opc.tcp://gateway.cloudprovider.com:4840/UAServer
Security Mode: SignAndEncrypt
Security Policy: Basic256Sha256
Authentication: Username/Password
  Username: company_client
  Password: ********
Publishing Interval: 2000 ms
Timeout: 30000 ms
Auto Reconnect: Enabled
Reconnect Interval: 30 seconds
Keep Alive: 20000 ms
```

**Use Case:** Remote monitoring via internet, higher latency

## Related Documentation

- **[Installation Guide](INSTALLATION.md)** - Setting up WinCC OA MCP Server
- **[Configuration Guide](CONFIGURATION.md)** - General server configuration
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Tools Reference](TOOLS.md)** - Available MCP tools for OPC UA datapoints

## Additional Resources

### WinCC OA Documentation

- WinCC OA Online Help: OPC UA Driver section
- Siemens Industry Online Support
- WinCC OA User Manual, Chapter: "Drivers and Peripherals"

### OPC UA Resources

- OPC Foundation: https://opcfoundation.org/
- OPC UA Specification: IEC 62541
- OPC UA Security: Best practices and guidelines

## Support

For issues specific to:
- **WinCC OA System**: Contact Siemens support
- **OPC UA Server**: Contact server vendor
- **MCP Server**: See [Troubleshooting](TROUBLESHOOTING.md) or open an issue

---

**Last Updated:** 2025-10-10  
**WinCC OA Version:** 3.20+  
**OPC UA Version:** 1.04+
