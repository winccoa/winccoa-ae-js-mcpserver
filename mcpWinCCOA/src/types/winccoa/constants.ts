/**
 * WinCC OA Constants
 *
 * Constants for datapoint configs, transformations, and address modes.
 */

/**
 * Datapoint Config Type Constants
 */
export enum DpConfigType {
  /** No config */
  DPCONFIG_NONE = 0,
  /** Peripheral address config */
  DPCONFIG_PERIPH_ADDR_MAIN = 16,
  /** Distribution/manager allocation config */
  DPCONFIG_DISTRIBUTION_INFO = 56
}

/**
 * Address Direction Modes
 */
export enum DpAddressDirection {
  /** Undefined */
  DPATTR_ADDR_MODE_UNDEFINED = 0,
  /** Standard output (group connection) */
  DPATTR_ADDR_MODE_OUTPUT = 1,
  /** Input for spontaneous data */
  DPATTR_ADDR_MODE_INPUT_SPONT = 2,
  /** Input for single queries */
  DPATTR_ADDR_MODE_INPUT_SQUERY = 3,
  /** Input for polling (cyclic query) */
  DPATTR_ADDR_MODE_INPUT_POLL = 4,
  /** Output with single connection */
  DPATTR_ADDR_MODE_OUTPUT_SINGLE = 5,
  /** Input/output for spontaneous data */
  DPATTR_ADDR_MODE_IO_SPONT = 6,
  /** Input/output for polling */
  DPATTR_ADDR_MODE_IO_POLL = 7,
  /** Input/output for single queries */
  DPATTR_ADDR_MODE_IO_SQUERY = 8,
  /** Hardware alert handling */
  DPATTR_ADDR_MODE_AM_ALERT = 9,
  /** Currently not in use */
  DPATTR_ADDR_MODE_INPUT_ON_DEMAND = 10,
  /** Input, polled only if query exists (dpConnect) */
  DPATTR_ADDR_MODE_INPUT_CYCLIC_ON_USE = 11,
  /** Currently not in use */
  DPATTR_ADDR_MODE_IO_ON_DEMAND = 12,
  /** Input/output, polled only if query exists */
  DPATTR_ADDR_MODE_IO_CYCLIC_ON_USE = 13,
  /** Input, subscribed only if query exists */
  DPATTR_ADDR_MODE_INPUT_SPONT_ON_USE = 14,
  /** Input/output, subscribed only if query exists */
  DPATTR_ADDR_MODE_IO_SPONT_ON_USE = 15,
  /** Obsolete - use _internal attribute instead */
  DPATTR_ADDR_MODE_INTERNAL = 32,
  /** Obsolete - use _lowlevel attribute instead */
  DPATTR_ADDR_MODE_LOW_LEVEL_FLAG = 64
}

/**
 * OPC UA Transformation/Datatype Constants
 */
export enum OpcUaDatatype {
  /** Default - automatic type detection */
  DEFAULT = 750,
  /** Boolean */
  BOOLEAN = 751,
  /** Signed Byte */
  SBYTE = 752,
  /** Byte */
  BYTE = 753,
  /** 16-bit Integer signed */
  INT16 = 754,
  /** 16-bit Integer unsigned */
  UINT16 = 755,
  /** 32-bit Integer signed */
  INT32 = 756,
  /** 32-bit Integer unsigned */
  UINT32 = 757,
  /** 64-bit Integer signed */
  INT64 = 758,
  /** 64-bit Integer unsigned */
  UINT64 = 759,
  /** Floating-point value */
  FLOAT = 760,
  /** Floating-point value, double precision */
  DOUBLE = 761,
  /** String */
  STRING = 762,
  /** Date & Time */
  DATETIME = 763,
  /** Unique Identifier */
  GUID = 764,
  /** Byte String */
  BYTESTRING = 765,
  /** XML Element */
  XMLELEMENT = 766,
  /** Node ID */
  NODEID = 767,
  /** Localized Text */
  LOCALIZEDTEXT = 768
}
