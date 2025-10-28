/**
 * Type declarations for winccoa-manager package
 *
 * This provides TypeScript type definitions for the WinCC OA manager package.
 */

declare module 'winccoa-manager' {
  export class WinccoaManager {
    constructor();

    // Datapoint operations
    dpExists(dpName: string): boolean;
    dpCreate(dpName: string, dpType: string, systemId?: number, dpId?: number): Promise<boolean>;
    dpDelete(dpName: string | string[]): Promise<boolean>;
    dpGet(dpe: string | string[]): Promise<any>;
    dpSet(dpe: string | string[], value: any): boolean;
    dpSetWait(dpe: string | string[], value: any): Promise<void>;
    dpConnect(callback: (dpes: string[]) => void, dpes: string[], sendInitial?: boolean): number;
    dpDisconnect(connId: number): void;
    dpNames(pattern?: string, dpType?: string, ignoreCase?: boolean): string[];

    // Datapoint type operations
    dpTypes(pattern?: string, systemId?: number, includeEmpty?: boolean): string[];
    dpTypeGet(dpType: string, withSubTypes?: boolean): any;
    dpTypeName(dpName: string): string;
    dpTypeCreate(typeNode: WinccoaDpTypeNode): Promise<boolean>;
    dpGetUnit(dpElement: string): string;
    dpGetDescription(dpElement: string): string;

    // Other properties
    dpElementType?: number;
  }

  export class WinccoaDpTypeNode {
    constructor(name: string, type: number, refName: string, children: WinccoaDpTypeNode[]);
    name: string;
    type: number;
    refName: string;
    children: WinccoaDpTypeNode[];
  }
}
