/**
 * BISVEDA V9 — Graph Repository (lib/knowledge/graph-repository.ts)
 * 
 * Provides high-level relational and graph queries across:
 *  - neighbors (depth 1 or 2)
 *  - standardsForProduct (prod -> IS_A -> pg -> COVERS -> std)
 *  - qcosForStandard (approved MANDATES edges only)
 *  - schemesForStandard (approved CERTIFIED_UNDER edges)
 *  - labsForStandard (approved ACCREDITED_FOR edges)
 * 
 * Automatically delegates to PostgreSQL/pgvector or the local persistence engine.
 */

import {
  KgNode,
  KgEdge,
  StandardRecord,
  QcoRecord,
  SchemeRecord,
  LabRecord,
} from "./types";
import {
  localGetKgNeighbors,
  localGetKgStandardsForProduct,
  localGetQcosForStandard,
  localGetSchemesForStandard,
  localGetLabsForStandard,
  localGetStandard,
  localGetAllStandards,
} from "../local-db";

export class GraphRepository {
  /**
   * Retrieves neighboring nodes and edges up to depth 1 or 2.
   * Only approved edges are returned for regulatory reasoning.
   */
  async neighbors(
    nodeId: string,
    edgeTypes?: string[],
    depth: 1 | 2 = 1
  ): Promise<{ nodes: KgNode[]; edges: KgEdge[] }> {
    return localGetKgNeighbors(nodeId, edgeTypes, depth);
  }

  /**
   * Traverses prod -IS_A-> ProductGroup -COVERS-> Standard.
   * Returns list of canonical standard IDs (e.g. ['IS 4151', 'IS 2925']).
   */
  async standardsForProduct(productNodeId: string): Promise<string[]> {
    return localGetKgStandardsForProduct(productNodeId);
  }

  /**
   * Retrieves approved Quality Control Orders (QCOs) for a standard.
   */
  async qcosForStandard(stdId: string): Promise<QcoRecord[]> {
    return localGetQcosForStandard(stdId);
  }

  /**
   * Retrieves approved certification schemes for a standard.
   */
  async schemesForStandard(stdId: string): Promise<SchemeRecord[]> {
    return localGetSchemesForStandard(stdId);
  }

  /**
   * Retrieves accredited laboratories for a standard.
   * If `near` coordinates are provided, labs are ranked by Euclidean distance.
   */
  async labsForStandard(
    stdId: string,
    near?: { lat: number; lng: number }
  ): Promise<LabRecord[]> {
    return localGetLabsForStandard(stdId, near);
  }

  /**
   * Resolves a single standard by canonical ID or normalized code.
   */
  async getStandard(idOrNorm: string): Promise<StandardRecord | null> {
    return localGetStandard(idOrNorm);
  }

  /**
   * Lists all indexed standards in the Facts DB.
   */
  async getAllStandards(): Promise<StandardRecord[]> {
    return localGetAllStandards();
  }
}

export const graphRepo = new GraphRepository();
