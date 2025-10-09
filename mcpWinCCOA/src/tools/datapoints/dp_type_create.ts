/**
 * Datapoint Type Creation Tools
 *
 * MCP tools for creating datapoint types with complex structures.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Map of string type names to WinccoaElementType enum values
 */
const ELEMENT_TYPE_MAP: Record<string, number> = {
  Struct: 1,
  Int: 21,
  Float: 22,
  Bool: 23,
  Bit32: 24,
  String: 25,
  Time: 26,
  Dpid: 27,
  Char: 19,
  UInt: 20,
  Typeref: 41,
  LangString: 42,
  Blob: 46,
  Long: 54,
  ULong: 58,
  Bit64: 50,
  // Dynamic arrays
  DynChar: 3,
  DynUInt: 4,
  DynInt: 5,
  DynFloat: 6,
  DynBool: 7,
  DynBit32: 8,
  DynString: 9,
  DynTime: 10,
  DynDpid: 29,
  DynLangString: 44,
  DynBlob: 48,
  DynBit64: 51,
  DynLong: 55,
  DynULong: 59,
  // Structs
  UIntStruct: 12,
  IntStruct: 13,
  FloatStruct: 14,
  BoolStruct: 15,
  Bit32Struct: 16,
  StringStruct: 17,
  TimeStruct: 18,
  CharStruct: 11,
  DynCharStruct: 30,
  DynUIntStruct: 31,
  DynIntStruct: 32,
  DynFloatStruct: 33,
  DynBoolStruct: 34,
  DynBit32Struct: 35,
  DynStringStruct: 36,
  DynTimeStruct: 37,
  DynDpidStruct: 38,
  DpidStruct: 39,
  LangStringStruct: 43,
  DynLangStringStruct: 45,
  BlobStruct: 47,
  DynBlobStruct: 49,
  Bit64Struct: 52,
  DynBit64Struct: 53,
  LongStruct: 56,
  DynLongStruct: 57,
  ULongStruct: 60,
  DynULongStruct: 61
};

/**
 * JSON node structure for datapoint type definition
 */
interface JsonDpTypeNode {
  name: string;
  type: string;
  refName?: string;
  children?: JsonDpTypeNode[];
}

/**
 * WinccoaDpTypeNode-compatible structure
 */
interface DpTypeNode {
  name: string;
  type: number;
  refName: string;
  children: DpTypeNode[];
}

/**
 * Convert a JSON structure to WinccoaDpTypeNode tree
 * @param jsonNode - JSON node definition
 * @returns WinccoaDpTypeNode-compatible object
 */
function jsonToWinccoaDpTypeNode(jsonNode: JsonDpTypeNode): DpTypeNode {
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
  const node: DpTypeNode = {
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
 * @param server - MCP server instance
 * @param context - Shared context with winccoa instance
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "dp-type-create",
    `Create a new datapoint type (DPT) in the WinCC OA system.

Creates a complete datapoint type tree structure with elements and optional nested structures.

Parameters:
- typeName: Name of the datapoint type to be created (required)
- structure: JSON object defining the type structure (required)
  - name: Element name (string, required)
  - type: Element type (string, required) - see available types below
  - refName: Reference type name (string, optional, required for Typeref elements)
  - children: Array of child elements (array, optional, for Struct types)

Available Element Types:
Basic Types: Int, Float, Bool, String, Time, Char, UInt, Long, ULong, Bit32, Bit64, Blob, Dpid, LangString
Dynamic Arrays: DynInt, DynFloat, DynBool, DynString, DynTime, DynChar, DynUInt, DynLong, DynULong, DynBit32, DynBit64, DynBlob, DynDpid, DynLangString
Structures: Struct, IntStruct, FloatStruct, BoolStruct, StringStruct, TimeStruct, etc.
Special: Typeref (requires refName parameter)

Example - Simple Type:
{
  "typeName": "MySimpleType",
  "structure": {
    "name": "MySimpleType",
    "type": "Struct",
    "children": [
      { "name": "id", "type": "Int" },
      { "name": "value", "type": "Float" },
      { "name": "text", "type": "String" }
    ]
  }
}

Example - Complex Type with Typeref:
{
  "typeName": "ComplexType",
  "structure": {
    "name": "ComplexType",
    "type": "Struct",
    "children": [
      { "name": "reference", "type": "Typeref", "refName": "ExampleDP_Float" },
      {
        "name": "settings",
        "type": "Struct",
        "children": [
          { "name": "enabled", "type": "Bool" },
          { "name": "setpoint", "type": "Float" }
        ]
      }
    ]
  }
}

Returns: Success confirmation with datapoint type details or error message.

Throws WinccoaError if:
- Invalid argument types
- Invalid typeName or element type
- Type name contains invalid characters or is empty
- Datapoint type with given name already exists
- Reference type (refName) does not exist`,
    {
      typeName: z.string().min(1, "typeName must be a non-empty string"),
      structure: z
        .object({
          name: z.string(),
          type: z.string(),
          refName: z.string().optional(),
          children: z.array(z.any()).optional()
        })
        .passthrough()
    },
    async ({ typeName, structure }: { typeName: string; structure: JsonDpTypeNode }) => {
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
        let typeTree: DpTypeNode;
        try {
          typeTree = jsonToWinccoaDpTypeNode(structure);
        } catch (conversionError) {
          const errorMessage = conversionError instanceof Error ? conversionError.message : String(conversionError);
          console.error('Error converting structure:', conversionError);
          return createErrorResponse(`Invalid structure definition: ${errorMessage}`, {
            errorType: 'INVALID_STRUCTURE',
            typeName,
            details: errorMessage
          });
        }

        console.log(`Type tree created, calling dpTypeCreate...`);

        // Import WinccoaDpTypeNode class from winccoa-manager
        const { WinccoaDpTypeNode } = await import('winccoa-manager');

        // Recursively create WinccoaDpTypeNode instances
        function createNodeInstance(nodeData: DpTypeNode): any {
          const children = nodeData.children.map(child => createNodeInstance(child));
          return new WinccoaDpTypeNode(nodeData.name, nodeData.type, nodeData.refName || '', children);
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
        const err = error as Error;
        console.error(`Error creating datapoint type '${typeName}':`, error);

        // Handle specific WinCC OA errors
        let errorMessage = `Error creating datapoint type '${typeName}': ${err.message}`;
        let errorType = 'UNKNOWN_ERROR';

        if (err.message.includes('already exist')) {
          errorMessage = `Datapoint type '${typeName}' already exists`;
          errorType = 'DP_TYPE_ALREADY_EXISTS';
        } else if (err.message.includes('invalid characters')) {
          errorMessage = `Invalid datapoint type name '${typeName}' - contains invalid characters`;
          errorType = 'INVALID_TYPE_NAME';
        } else if (err.message.includes('empty')) {
          errorMessage = `Invalid datapoint type name - cannot be empty`;
          errorType = 'INVALID_TYPE_NAME';
        } else if (err.message.includes('refName')) {
          errorMessage = `Referenced type does not exist or is invalid`;
          errorType = 'INVALID_REFERENCE';
        }

        return createErrorResponse(errorMessage, {
          errorCode: (err as any).code || undefined,
          errorType,
          typeName,
          details: err.message
        });
      }
    }
  );

  return 1; // Number of tools registered
}
