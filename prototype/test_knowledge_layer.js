const { resolveTaxonomy } = require("./src/lib/taxonomy.ts");
const { checkOutdatedReference } = require("./src/lib/outdated-checker.ts");
const { localSearchFtsChunks, localSearchVectorChunks, localSearchExactChunks } = require("./src/lib/local-db.ts");
const labsData = require("./data/laboratories.json");
const qcosData = require("./data/qcos.json");

async function verifyKnowledgeLayer() {
  console.log("=== PHASE 2: KNOWLEDGE LAYER VERIFICATION ===");

  // 2.1 Lexical Search (FTS)
  console.log("\n[2.1 Lexical Search (FTS)]");
  const ftsResults = await localSearchFtsChunks("impact absorption drop tower", 3);
  console.log(`Found ${ftsResults.length} FTS chunks:`);
  for (const c of ftsResults) {
    console.log(`  - Chunk: ${c.chunk_id} | Standard: ${c.standard_number} | Sim: ${c.similarity}`);
  }
  const exactResults = await localSearchExactChunks("IS 4151", 3);
  console.log(`Found ${exactResults.length} exact IS 4151 chunks.`);

  // 2.2 Relationship / Graph Layer
  console.log("\n[2.2 Relationship / Graph Layer]");
  const taxHelmets = resolveTaxonomy("two wheeler helmets");
  console.log(`Taxonomy 'two wheeler helmets' -> matched: ${taxHelmets.matched}, standards: ${taxHelmets.suggestedStandards.join(", ")}`);
  
  const taxSariya = resolveTaxonomy("sariya");
  console.log(`Taxonomy 'sariya' (colloquial) -> matched: ${taxSariya.matched}, standards: ${taxSariya.suggestedStandards.join(", ")}`);

  const outdated = checkOutdatedReference("IS 4151:2009");
  console.log(`Supersession check for 'IS 4151:2009' -> isOutdated: ${Boolean(outdated)}, current: ${outdated?.currentStandard || "none"}`);

  // 2.3 Facts DB (Structured Data)
  console.log("\n[2.3 Facts DB (Structured Data)]");
  const labs = labsData.filter((l) => (l.recognized_standards || []).some((s) => s.includes("4151")));
  console.log(`Recognized laboratories for IS 4151: ${labs.length} labs found (e.g., ${labs.slice(0, 2).map(l => l.name).join("; ")})`);

  const qco4151 = qcosData.find((q) => q.standard_number?.includes("4151"));
  console.log(`QCO lookup for IS 4151 -> mandatory: ${Boolean(qco4151)}, title: ${qco4151?.title || qco4151?.order_name}`);

  console.log("\n=== KNOWLEDGE LAYER VERIFICATION COMPLETE ===");
}

verifyKnowledgeLayer();
