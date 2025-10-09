import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Map of string type names to WinccoaElementType enum values
 */
const ELEMENT_TYPE_MAP = {
  'Struct': 1,
  'Int': 21,
  'Float': 22,
  'Bool': 23,
  'Bit32': 24,
  'String': 25,
  'Time': 26,
  'Dpid': 27,
  'Char': 19,
  'UInt': 20,
  'Typeref': 41,
  'LangString': 42,
  'Blob': 46,
  'Long': 54,
  'ULong': 58,
  'Bit64': 50,
  // Dynamic arrays
  'DynChar': 3,
  'DynUInt': 4,
  'DynInt': 5,
  'DynFloat': 6,
  'DynBool': 7,
  'DynBit32': 8,
  'DynString': 9,
  'DynTime': 10,
  'DynDpid': 29,
  'DynLangString': 44,
  'DynBlob': 48,
  'DynBit64': 51,
  'DynLong': 55,
  'DynULong': 59,
  // Structs
  'UIntStruct': 12,
  'IntStruct': 13,
  'FloatStruct': 14,
  'BoolStruct': 15,
  'Bit32Struct': 16,
  'StringStruct': 17,
  'TimeStruct': 18,
  'CharStruct': 11,
  'DynCharStruct': 30,
  'DynUIntStruct': 31,
  'DynIntStruct': 32,
  'DynFloatStruct': 33,
  'DynBoolStruct': 34,
  'DynBit32Struct': 35,
  'DynStringStruct': 36,
  'DynTimeStruct': 37,
  'DynDpidStruct': 38,
  'DpidStruct': 39,
  'LangStringStruct': 43,
  'DynLangStringStruct': 45,
  'BlobStruct': 47,
  'DynBlobStruct': 49,
  'Bit64Struct': 52,
  'DynBit64Struct': 53,
  'LongStruct': 56,
  'DynLongStruct': 57,
  'ULongStruct': 60,
  'DynULongStruct': 61
};

/**
 * Convert a JSON structure to WinccoaDpTypeNode tree
 * @param {Object} jsonNode - JSON node definition
 * @returns {Object} WinccoaDpTypeNode-compatible object
 */
function jsonToWinccoaDpTypeNode(jsonNode) {
  if (!jsonNode || typeof jsonNode !== 'object') {
    throw new Error('Invalid node structure: must be an object');
  }

  if (!jsonNode.name || typeof jsonNode.name !== 'string') {
    throw new Error('Invalid node structure: name is required and must be a string');
  }

  if (!jsonNode.type || typeof jsonNode.type !== 'string') {
    throw new Error(`Invalid node structure for '${jsonNode.name}': type is required and must be a string`);
  }

  // Map type string to enum value
  const elementType = ELEMENT_TYPE_MAP[jsonNode.type];
  if (elementType === undefined) {
    const validTypes = Object.keys(ELEMENT_TYPE_MAP).join(', ');
    throw new Error(`Invalid element type '${jsonNode.type}' for node '${jsonNode.name}'. Valid types: ${validTypes}`);
  }

  // Build the node object
  const node = {
    name: jsonNode.name,
    type: elementType,
    refName: jsonNode.refName || '',
    children: []
  };

  // Recursively process children
  if (Array.isArray(jsonNode.children)) {
    node.children = jsonNode.children.map(child => jsonToWinccoaDpTypeNode(child));
  }

  return node;
}

/**
 * Register datapoint type creation tools
 * @param {Object} server - MCP server instance
 * @param {Object} context - Shared context with winccoa instance
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;

  server.tool("dp-type-create", "Create a new datapoint type (DPT) in the WinCC OA system.\n" +
      "\nCreates a complete datapoint type tree structure with elements and optional nested structures.\n" +
      "\nParameters:\n" +
      "- typeName: Name of the datapoint type to be created (required)\n" +
      "- structure: JSON object defining the type structure (required)\n" +
      "  - name: Element name (string, required)\n" +
      "  - type: Element type (string, required) - see available types below\n" +
      "  - refName: Reference type name (string, optional, required for Typeref elements)\n" +
      "  - children: Array of child elements (array, optional, for Struct types)\n" +
      "\nAvailable Element Types:\n" +
      "Basic Types: Int, Float, Bool, String, Time, Char, UInt, Long, ULong, Bit32, Bit64, Blob, Dpid, LangString\n" +
      "Dynamic Arrays: DynInt, DynFloat, DynBool, DynString, DynTime, DynChar, DynUInt, DynLong, DynULong, DynBit32, DynBit64, DynBlob, DynDpid, DynLangString\n" +
      "Structures: Struct, IntStruct, FloatStruct, BoolStruct, StringStruct, TimeStruct, etc.\n" +
      "Special: Typeref (requires refName parameter)\n" +
      "\nExample - Simple Type:\n" +
      "{\n" +
      "  \"typeName\": \"MySimpleType\",\n" +
      "  \"structure\": {\n" +
      "    \"name\": \"MySimpleType\",\n" +
      "    \"type\": \"Struct\",\n" +
      "    \"children\": [\n" +
      "      { \"name\": \"id\", \"type\": \"Int\" },\n" +
      "      { \"name\": \"value\", \"type\": \"Float\" },\n" +
      "      { \"name\": \"text\", \"type\": \"String\" }\n" +
      "    ]\n" +
      "  }\n" +
      "}\n" +
      "\nExample - Complex Type with Typeref:\n" +
      "{\n" +
      "  \"typeName\": \"ComplexType\",\n" +
      "  \"structure\": {\n" +
      "    \"name\": \"ComplexType\",\n" +
      "    \"type\": \"Struct\",\n" +
      "    \"children\": [\n" +
      "      { \"name\": \"reference\", \"type\": \"Typeref\", \"refName\": \"ExampleDP_Float\" },\n" +
      "      { \n" +
      "        \"name\": \"settings\", \n" +
      "        \"type\": \"Struct\", \n" +
      "        \"children\": [\n" +
      "          { \"name\": \"enabled\", \"type\": \"Bool\" },\n" +
      "          { \"name\": \"setpoint\", \"type\": \"Float\" }\n" +
      "        ]\n" +
      "      }\n" +
      "    ]\n" +
      "  }\n" +
      "}\n" +
      "\nReturns: Success confirmation with datapoint type details or error message.\n" +
      "\nThrows WinccoaError if:\n" +
      "- Invalid argument types\n" +
      "- Invalid typeName or element type\n" +
      "- Type name contains invalid characters or is empty\n" +
      "- Datapoint type with given name already exists\n" +
      "- Reference type (refName) does not exist", {
    typeName: z.string().min(1, "typeName must be a non-empty string"),
    structure: z.object({
      name: z.string(),
      type: z.string(),
      refName: z.string().optional(),
      children: z.array(z.any()).optional()
    }).passthrough()
  }, async ({ typeName, structure }) => {
    try {
      console.log(`Creating datapoint type '${typeName}'`);

      // Check if winccoa instance is available
      if (!winccoa) {
        throw new Error('WinCC OA connection not available');
      }

      // Validate that structure name matches typeName
      if (structure.name !== typeName) {
        console.warn(`Structure name '${structure.name}' does not match typeName '${typeName}'. Using typeName.`);
        structure.name = typeName;
      }

      // Convert JSON structure to WinccoaDpTypeNode tree
      let typeTree;
      try {
        typeTree = jsonToWinccoaDpTypeNode(structure);
      } catch (conversionError) {
        console.error('Error converting structure:', conversionError);
        return createErrorResponse(`Invalid structure definition: ${conversionError.message}`, {
          errorType: 'INVALID_STRUCTURE',
          typeName,
          details: conversionError.message
        });
      }

      console.log(`Type tree created, calling dpTypeCreate...`);

      // Import WinccoaDpTypeNode class from winccoa-manager
      const { WinccoaDpTypeNode } = await import('winccoa-manager');

      // Recursively create WinccoaDpTypeNode instances
      function createNodeInstance(nodeData) {
        const children = nodeData.children.map(child => createNodeInstance(child));
        return new WinccoaDpTypeNode(
          nodeData.name,
          nodeData.type,
          nodeData.refName || '',
          children
        );
      }

      const rootNode = createNodeInstance(typeTree);

      // Call dpTypeCreate
      const result = await winccoa.dpTypeCreate(rootNode);

      if (result) {
        const successMessage = `Successfully created datapoint type '${typeName}'`;
        console.log(successMessage);
        return createSuccessResponse({
          typeName,
          structure: typeTree,
          message: successMessage
        });
      } else {
        const errorMessage = `Failed to create datapoint type '${typeName}'`;
        console.error(errorMessage);
        return createErrorResponse(errorMessage);
      }

    } catch (error) {
      console.error(`Error creating datapoint type '${typeName}':`, error);

      // Handle specific WinCC OA errors
      let errorMessage = `Error creating datapoint type '${typeName}': ${error.message}`;
      let errorType = 'UNKNOWN_ERROR';

      if (error.message.includes('already exist')) {
        errorMessage = `Datapoint type '${typeName}' already exists`;
        errorType = 'DP_TYPE_ALREADY_EXISTS';
      } else if (error.message.includes('invalid characters')) {
        errorMessage = `Invalid datapoint type name '${typeName}' - contains invalid characters`;
        errorType = 'INVALID_TYPE_NAME';
      } else if (error.message.includes('empty')) {
        errorMessage = `Invalid datapoint type name - cannot be empty`;
        errorType = 'INVALID_TYPE_NAME';
      } else if (error.message.includes('refName')) {
        errorMessage = `Referenced type does not exist or is invalid`;
        errorType = 'INVALID_REFERENCE';
      }

      return createErrorResponse(errorMessage, {
        errorCode: error.code || undefined,
        errorType,
        typeName,
        details: error.message
      });
    }
  });

  return 1; // Number of tools registered
}
