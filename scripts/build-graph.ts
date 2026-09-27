/**
 * BISVEDA V9 — Knowledge Graph Builder (scripts/build-graph.ts)
 * 
 * Rebuilds all knowledge graph nodes and edges from Facts DB and taxonomy.
 * Nodes: Standard, Clause, QCO, Scheme, Lab, ProductGroup, Product, Committee, Document, DocVersion, Chunk.
 * Edges: MANDATES, CERTIFIED_UNDER, ACCREDITED_FOR, COVERS, IS_A, MAINTAINS, SUPERSEDES, HAS_VERSION, DOCUMENTS, HAS_CHUNK, HAS_CLAUSE.
 * 
 * Usage:
 *   npx tsx scripts/build-graph.ts
 */

import fs from "fs";
import path from "path";
import {
  localGetAllStandards,
  localGetDocumentVersions,
  localUpsertKg,
} from "../prototype/src/lib/local-db";
import type { KgNode, KgEdge } from "../prototype/src/lib/knowledge/types";

// Load environment
const envPaths = [
  path.resolve(process.cwd(), "prototype/.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../prototype/.env"),
  path.resolve(__dirname, "../.env"),
];
for (const ep of envPaths) {
  if (fs.existsSync(ep)) {
    const lines = fs.readFileSync(ep, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

async function buildGraph() {
  console.log("================================================================================");
  console.log("  BISVEDA V9 — Building Knowledge Graph (kg_nodes & kg_edges)");
  console.log("================================================================================\n");

  const candidateDirs = [
    path.resolve(process.cwd(), "prototype/data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(__dirname, "../prototype/data"),
    path.resolve(__dirname, "../data"),
  ];
  const dataDir = candidateDirs.find((d) => fs.existsSync(path.join(d, "standards.json"))) || "";
  const localDbPath = path.join(dataDir, "bisveda_local_db.json");
  const localDb = fs.existsSync(localDbPath) ? JSON.parse(fs.readFileSync(localDbPath, "utf-8")) : {};

  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const nodeSet = new Set<string>();

  function addNode(node: KgNode) {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  }

  function addEdge(edge: KgEdge) {
    edges.push(edge);
  }

  // 1. Standards Nodes
  const allStandards = await localGetAllStandards();
  for (const std of allStandards) {
    const stdId = `std:${std.id}`;
    addNode({
      id: stdId,
      type: "Standard",
      label: `${std.id} — ${std.title}`,
      props: {
        is_number: std.id,
        year: std.year,
        knowledge_tier: std.knowledge_tier,
        status: std.status,
      },
    });

    if (std.committee) {
      const commId = `comm:${std.committee}`;
      addNode({ id: commId, type: "Committee", label: `BIS Technical Committee: ${std.committee}` });
      addEdge({ src: commId, dst: stdId, type: "MAINTAINS", status: "approved" });
    }
  }

  // 2. QCO Nodes & MANDATES Edges
  const qcos = Object.values(localDb.qcos || {}) as any[];
  for (const q of qcos) {
    const qId = `qco:${q.id}`;
    addNode({
      id: qId,
      type: "QCO",
      label: q.title,
      props: { ministry: q.ministry, status: q.status, effective_on: q.effective_on },
    });
  }

  for (const qLink of localDb.qco_standards || []) {
    const qId = `qco:${qLink.qco_id}`;
    const stdId = `std:${qLink.standard_id}`;
    if (nodeSet.has(qId) && nodeSet.has(stdId)) {
      addEdge({
        src: qId,
        dst: stdId,
        type: "MANDATES",
        source_url: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
        status: "approved",
      });
    }
  }

  // 3. Scheme Nodes & CERTIFIED_UNDER Edges
  const schemes = Object.values(localDb.schemes || {}) as any[];
  for (const sc of schemes) {
    const scId = `scheme:${sc.id}`;
    addNode({
      id: scId,
      type: "Scheme",
      label: sc.name,
      props: { summary: sc.summary },
    });
  }

  for (const sLink of localDb.standard_schemes || []) {
    const stdId = `std:${sLink.standard_id}`;
    const scId = `scheme:${sLink.scheme_id}`;
    if (nodeSet.has(stdId) && nodeSet.has(scId)) {
      addEdge({
        src: stdId,
        dst: scId,
        type: "CERTIFIED_UNDER",
        source_url: "https://www.bis.gov.in/product-certification/",
        status: "approved",
      });
    }
  }

  // 4. Lab Nodes & ACCREDITED_FOR Edges
  const labs = Object.values(localDb.labs || {}) as any[];
  for (const lb of labs) {
    const lId = `lab:${lb.id}`;
    addNode({
      id: lId,
      type: "Lab",
      label: `${lb.name} (${lb.city})`,
      props: { city: lb.city, state: lb.state, lat: lb.lat, lng: lb.lng },
    });
  }

  for (const lbLink of localDb.lab_scopes || []) {
    const lId = `lab:${lbLink.lab_id}`;
    const stdId = `std:${lbLink.standard_id}`;
    if (nodeSet.has(lId) && nodeSet.has(stdId)) {
      addEdge({
        src: lId,
        dst: stdId,
        type: "ACCREDITED_FOR",
        source_url: "https://www.lims.bis.gov.in/",
        status: "approved",
      });
    }
  }

  // 5. Taxonomy Nodes: ProductGroup (pg:*), Product (prod:*), COVERS, IS_A
  const groupsFile = path.join(dataDir, "taxonomy/groups.json");
  if (fs.existsSync(groupsFile)) {
    const taxonomy = JSON.parse(fs.readFileSync(groupsFile, "utf-8"));
    for (const div of taxonomy.divisions || []) {
      for (const pg of div.product_groups || []) {
        const pgId = `pg:${pg.id}`;
        addNode({
          id: pgId,
          type: "ProductGroup",
          label: pg.name,
          props: { division: div.name, priority: pg.priority },
        });

        // pg -COVERS-> std
        for (const isNum of pg.known_is_numbers || []) {
          const stdId = `std:${isNum}`;
          if (nodeSet.has(stdId)) {
            addEdge({ src: pgId, dst: stdId, type: "COVERS", status: "approved" });
          }
        }

        // prod -IS_A-> pg
        for (const pType of pg.product_types || []) {
          const pId = `prod:${pType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          addNode({ id: pId, type: "Product", label: pType });
          addEdge({ src: pId, dst: pgId, type: "IS_A", status: "approved" });
        }

        // Synonyms as products
        for (const syn of pg.synonyms || []) {
          const sId = `prod:${syn.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          addNode({ id: sId, type: "Product", label: syn });
          addEdge({ src: sId, dst: pgId, type: "IS_A", status: "approved" });
        }
      }
    }
  }

  // 6. Document & Version Nodes: doc:*, ver:*, chunk:*
  const docVersions = await localGetDocumentVersions();
  for (const dv of docVersions) {
    const docId = `doc:${dv.document_id}`;
    const verId = `ver:${dv.id}`;

    addNode({ id: docId, type: "Document", label: `Document: ${dv.document_id}` });
    addNode({
      id: verId,
      type: "DocVersion",
      label: `Version ${dv.version_no} (${dv.status})`,
      props: { status: dv.status, sha256: dv.sha256 },
    });

    addEdge({ src: docId, dst: verId, type: "HAS_VERSION", status: "approved" });

    // Find matching standard
    const doc = localDb.documents?.[dv.document_id];
    if (doc?.standard_number) {
      const stdId = `std:${doc.standard_number}`;
      if (nodeSet.has(stdId)) {
        addEdge({ src: verId, dst: stdId, type: "DOCUMENTS", status: "approved" });
      }
    }
  }

  // 7. Chunks for published versions
  const publishedVerIds = new Set(docVersions.filter((v) => v.status === "published").map((v) => v.document_id));
  let chunkCount = 0;

  for (const cid of Object.keys(localDb.chunks || {})) {
    const c = localDb.chunks[cid];
    if (!publishedVerIds.has(c.document_id)) continue;

    const chunkNodeId = `chunk:${cid}`;
    addNode({
      id: chunkNodeId,
      type: "Chunk",
      label: `${c.standard_number || "STD"} Clause ${c.clause_number || "Gen"}`,
      props: { clause_id: c.clause_number, page: c.page_numbers?.[0] },
    });

    const docId = `doc:${c.document_id}`;
    if (nodeSet.has(docId)) {
      addEdge({ src: docId, dst: chunkNodeId, type: "HAS_CHUNK", status: "approved" });
    }

    if (c.standard_number && c.clause_number) {
      const clauseId = `clause:${c.standard_number}:${c.clause_number}`;
      addNode({ id: clauseId, type: "Clause", label: `${c.standard_number} Clause ${c.clause_number}` });
      const stdId = `std:${c.standard_number}`;
      if (nodeSet.has(stdId)) {
        addEdge({ src: stdId, dst: clauseId, type: "HAS_CLAUSE", status: "approved" });
      }
    }
    chunkCount++;
    if (chunkCount >= 1000) break; // Cap chunk nodes in global graph per spec
  }

  await localUpsertKg(nodes, edges);
  console.log(`✓ Graph built successfully:`);
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`  Edges: ${edges.length}`);

  // Summary by type
  const nodeTypeCounts: Record<string, number> = {};
  for (const n of nodes) nodeTypeCounts[n.type] = (nodeTypeCounts[n.type] || 0) + 1;
  console.log("\nNode Breakdown:");
  for (const [t, count] of Object.entries(nodeTypeCounts)) {
    console.log(`  - ${t}: ${count}`);
  }

  const edgeTypeCounts: Record<string, number> = {};
  for (const e of edges) edgeTypeCounts[e.type] = (edgeTypeCounts[e.type] || 0) + 1;
  console.log("\nEdge Breakdown:");
  for (const [t, count] of Object.entries(edgeTypeCounts)) {
    console.log(`  - ${t}: ${count}`);
  }
}

buildGraph().catch((err) => {
  console.error("Build graph error:", err);
  process.exit(1);
});
