# S7Plus Troubleshooting

## Setup Issues

### No S7Plus Driver in the Project

**Cause:** No S7Plus driver registered in Pmon.

**Solution:** Register the driver:
1. Open WinCC OA Console
2. Add manager `WCCOAs7plusdrv`
3. Options: `-num 1` (driver number)
4. Start mode: `always`

### Driver Number X is Used by Simulation Driver

**Cause:** The desired driver number conflicts with a simulation driver (`WCCOAsimudrv`).

**Solution:** Use a different driver number. Determine the next available number via Pmon.

## Connection Issues

### Connection Stays in "Connecting" Status

**Possible causes:**
- PLC not reachable (wrong IP address or network problem)
- Wrong PLC type configured (e.g., S7_1500 instead of PLCSim)
- Access point not available ("S7ONLINE" not configured in Windows)
- Firewall blocking S7Plus communication (TCP port 102)

**Resolution steps:**
1. Check PLC reachability: ping the IP address
2. Check PLC type: does `Config.PLCType` match the actual hardware?
3. Check the access point in the PG/PC interface settings
4. Check firewall rules for TCP port 102

### Connection Shows "Failure"

**Possible causes:**
- PLC type mismatch (most common error with PLCSim)
- TLS certificate issues
- Incorrect PLC password
- Driver not running

**Resolution steps:**
1. Check the WinCC OA log for detailed error messages
2. For PLCSim: PLC type must be `768`, not `16` (S7_1500)
3. For TLS: check CA certificates in the trust list
4. Check driver status in Pmon

### Connection Was Working, Now It Is Not

**Possible causes:**
- PLC was restarted or IP changed
- TLS certificate expired
- Network infrastructure changed
- Driver crashed

**Resolution steps:**
1. Check `State.ConnState`
2. Verify PLC reachability
3. Check WinCC OA log for driver crash messages
4. Disable and re-enable the connection (reconnect)

## Address Configuration Issues

### No Data After Address Configuration

**Possible causes:**
- Wrong symbolic path (typo in PLC variable name)
- Wrong direction (Output instead of IOPoll)
- Wrong driver number (address points to a different driver)
- Connection not in "Connected" status
- Poll group not active

**Resolution steps:**
1. Verify the symbolic path via browse
2. Check direction (IOPoll/7 for most use cases)
3. Driver number must match the `Config.DrvNumber` of the connection
4. Confirm `State.ConnState = 3`
5. Check `_PollGroup.Active = true`

### Subscription Does Not Trigger Updates

**Possible causes:**
- Address not registered in `_S7PlusConfig.Subscriptions`
- PLC value is actually not changing

**Resolution steps:**
1. Check `_S7PlusConfig.Subscriptions.Names` for poll group entry
2. Manually change the PLC value for testing

### Wrong Data Types / Corrupted Values

**Possible causes:**
- Transformation type does not match the PLC variable type
- String length (`itemLength`) too short for STRING/WSTRING

**Resolution steps:**
1. Use browse to check the `valueType` of the variable
2. Use transformation 1001 (DEFAULT) for auto-detection
3. For strings: set `itemLength` to the string length of the PLC definition

## Browse Issues

### Browse Returns No Results

**Possible causes:**
- Connection not established (for online browse)
- Wrong TIA export name or station name (for offline browse)
- `Config.StationName` does not match the browse mode
- Category filter too restrictive

**Resolution steps:**
1. Online: ensure `State.ConnState = 3`
2. Offline: use root browse to determine correct names
3. Check `Config.StationName` (Online: `S7Plus$Online|Online`, Offline: `Export|Station`)
4. Try browse with category "All"

### Browse Timeout (60 Seconds)

**Possible causes:**
- PLC responding slowly (high load)
- Network latency
- Very large PLC program with many variables

**Resolution steps:**
1. Narrow browse with a specific category
2. Use pagination with a smaller limit
3. Check network latency to the PLC
4. Consider offline browse for large projects

### Online Connection Cannot Browse Offline (or Vice Versa)

**Cause:** The browse mode is fixed by `Config.StationName` at connection creation.

**Solution:** Create a separate connection with the desired browse mode. Both can exist simultaneously.

## TLS Issues

### No CA Certificates When Creating a Connection

**Solution:** Add CA certificates to the trust list before creating the connection:
```
_S7PlusConfig.CaCertificates = ["root_ca.pem"]
```

### TLS Handshake Fails

**Possible causes:**
- CA certificate does not match the PLC certificate chain
- Certificate expired
- Certificate file not in the project directory (`data/s7plus/cert`)

**Resolution steps:**
1. Check the certificate chain (root CA + intermediate)
2. Check certificate expiration dates
3. Verify certificate files in `data/s7plus/cert`

## Driver Issues

### Driver Number Conflict

**Symptom:** Error message about an already occupied driver number.

**Solution:** Choose a different driver number. Determine occupied numbers via Pmon.

### Driver Does Not Start

**Possible causes:**
- WinCC OA license does not include the S7Plus driver
- Maximum number of managers reached
- Conflicting driver configuration

**Resolution steps:**
1. Check the WinCC OA license for S7Plus driver support
2. Check Pmon for maximum manager count
3. Check the WinCC OA log for driver startup errors

## Tips

### Recommended Setup Order
1. Register the S7Plus driver in Pmon
2. Add CA certificates (for TLS)
3. Create the connection
4. Wait for "Connected"
5. Browse the PLC structure
6. Configure addresses

### Testing with PLCSim
- Always use PLC type `768` (PLCSim)
- PLCSim may have different timing characteristics than real hardware
- Some features (e.g., TLS) are not available in simulation

### Performance
- Use subscription for values that change infrequently
- Use polling with an appropriate interval for rapidly changing values
- Place related variables on the same poll group for consistent timing
- Note the 800-node pagination limit for large PLC programs
