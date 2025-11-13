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
  /** Archive config */
  DPCONFIG_DB_ARCHIVEINFO = 4,
  /** Min/Max range check config */
  DPCONFIG_MINMAX_PVSS_RANGECHECK = 7,
  /** Set range check config */
  DPCONFIG_SET_PVSS_RANGECHECK = 8,
  /** Binary signal alert */
  DPCONFIG_ALERT_BINARYSIGNAL = 12,
  /** Non-binary signal alert */
  DPCONFIG_ALERT_NONBINARYSIGNAL = 13,
  /** Alert class */
  DPCONFIG_ALERT_CLASS = 14,
  /** Peripheral address config */
  DPCONFIG_PERIPH_ADDR_MAIN = 16,
  /** Distribution/manager allocation config */
  DPCONFIG_DISTRIBUTION_INFO = 56,
  /** Sum alert */
  DPCONFIG_SUM_ALERT = 59,
  /** Match range check config */
  DPCONFIG_MATCH_PVSS_RANGECHECK = 64
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

/**
 * Datapoint Element Types (from WinCC OA Documentation)
 * See: https://winccoa.cope-it.at - "Data types for DPEs"
 */
export enum DpeType {
  /** Structure */
  DPEL_STRUCT = 1,
  /** Dynamic character array */
  DPEL_DYN_CHAR = 3,
  /** Dynamic unsigned array */
  DPEL_DYN_UINT = 4,
  /** Dynamic integer array */
  DPEL_DYN_INT = 5,
  /** Dynamic float array */
  DPEL_DYN_FLOAT = 6,
  /** Dynamic bit array */
  DPEL_DYN_BOOL = 7,
  /** Dynamic bit pattern array */
  DPEL_DYN_BIT32 = 8,
  /** Dynamic text array */
  DPEL_DYN_STRING = 9,
  /** Dynamic time array */
  DPEL_DYN_TIME = 10,
  /** Character structure */
  DPEL_CHAR_STRUCT = 11,
  /** Unsigned integer structure */
  DPEL_UINT_STRUCT = 12,
  /** Integer structure */
  DPEL_INT_STRUCT = 13,
  /** Float structure */
  DPEL_FLOAT_STRUCT = 14,
  /** Bit structure */
  DPEL_BOOL_STRUCT = 15,
  /** Bit pattern structure */
  DPEL_BIT32_STRUCT = 16,
  /** Text structure */
  DPEL_STRING_STRUCT = 17,
  /** Time structure */
  DPEL_TIME_STRUCT = 18,
  /** Character */
  DPEL_CHAR = 19,
  /** Unsigned integer */
  DPEL_UINT = 20,
  /** Integer */
  DPEL_INT = 21,
  /** Floating point */
  DPEL_FLOAT = 22,
  /** Boolean/Bit */
  DPEL_BOOL = 23,
  /** Bit pattern */
  DPEL_BIT32 = 24,
  /** Text/String */
  DPEL_STRING = 25,
  /** Time */
  DPEL_TIME = 26,
  /** DP Identifier */
  DPEL_DPID = 27,
  /** Dynamic DP Identifier */
  DPEL_DYN_DPID = 29,
  /** Type reference */
  DPEL_TYPEREF = 41,
  /** Multilingual text */
  DPEL_LANGSTRING = 42,
  /** Multilingual text structure */
  DPEL_LANGSTRING_STRUCT = 43,
  /** Dynamic description array */
  DPEL_DYN_LANGSTRING = 44,
  /** Blob (binary large object) */
  DPEL_BLOB = 46,
  /** Blob structure */
  DPEL_BLOB_STRUCT = 47,
  /** Bit pattern 64 */
  DPEL_BIT64 = 50,
  /** Dynamic bit64 array */
  DPEL_DYN_BIT64 = 51,
  /** Bit64 structure */
  DPEL_BIT64_STRUCT = 52,
  /** Long integer (64 bit) */
  DPEL_LONG = 54,
  /** Dynamic long array */
  DPEL_DYN_LONG = 55,
  /** Long structure */
  DPEL_LONG_STRUCT = 56,
  /** Unsigned long (64 bit) */
  DPEL_ULONG = 58,
  /** Dynamic unsigned long array */
  DPEL_DYN_ULONG = 59,
  /** Unsigned long structure */
  DPEL_ULONG_STRUCT = 60
}

/**
 * Alert Acknowledge Types
 */
export enum DpAlertAckType {
  /** Single acknowledge */
  DPATTR_ACKTYPE_SINGLE = 1
}

/**
 * Alert Range Types
 */
export enum DpAlertRangeType {
  /** No range type */
  DPDETAIL_RANGETYPE_NONE = 0,
  /** Min/Max range */
  DPDETAIL_RANGETYPE_MINMAX = 4,
  /** Match range (for discrete alerts) */
  DPDETAIL_RANGETYPE_MATCH = 5
}

/**
 * Archive Process Types
 */
export enum DpArchiveProcessType {
  /** No archiving */
  DPATTR_ARCH_PROC_NONE = 0,
  /** Delete old values */
  DPATTR_ARCH_PROC_DEL = 1,
  /** Move to another archive */
  DPATTR_ARCH_PROC_MOVE = 2,
  /** Simple smoothing */
  DPATTR_ARCH_PROC_SIMPLESM = 3,
  /** Simple smoothing and move */
  DPATTR_ARCH_PROC_SIMPLESM_AND_MOVE = 4,
  /** Derivative smoothing */
  DPATTR_ARCH_PROC_DERIVSM = 5,
  /** Derivative smoothing and move */
  DPATTR_ARCH_PROC_DERIVSM_AND_MOVE = 6,
  /** Decimation */
  DPATTR_ARCH_PROC_DEC = 7,
  /** Decimation and move */
  DPATTR_ARCH_PROC_DEC_AND_MOVE = 8,
  /** Average value */
  DPATTR_ARCH_PROC_AVG_VAL = 9,
  /** Average value and move */
  DPATTR_ARCH_PROC_AVG_VAL_AND_MOVE = 10,
  /** Average at time T0 */
  DPATTR_ARCH_PROC_AVG_T0 = 11,
  /** Average at time T0 and move */
  DPATTR_ARCH_PROC_AVG_T0_AND_MOVE = 12,
  /** Average at time T1 */
  DPATTR_ARCH_PROC_AVG_T1 = 13,
  /** Average at time T1 and move */
  DPATTR_ARCH_PROC_AVG_T1_AND_MOVE = 14,
  /** Value archiving (standard archiving) */
  DPATTR_ARCH_PROC_VALARCH = 15
}
