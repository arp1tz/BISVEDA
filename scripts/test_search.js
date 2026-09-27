const { generateEmbedding } = require('../prototype/src/lib/embeddings.ts');
const { getDbPool } = require('../prototype/src/lib/db.ts');

async function test() {
  const query = "Safety of toys migration of certain elements ISO 8124 antimony barium lead";
  const vec = await generateEmbedding(query);
  const p = getDbPool();
  const embeddingSql = `[${vec.join(",")}]`;

  const res = await p.query(
    `SELECT c.chunk_id, c.standard_number, c.clause_number, (c.embedding <=> $1::vector) AS distance,
            (1 - (c.embedding <=> $1::vector)) AS similarity, c.text
     FROM chunks c
     JOIN documents d ON c.document_id = d.id
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector ASC
     LIMIT 5;`,
    [embeddingSql]
  );

  console.log("Top 5 closest matches:");
  for (const r of res.rows) {
    console.log(`- Dist: ${parseFloat(r.distance).toFixed(4)} | Sim: ${parseFloat(r.similarity).toFixed(4)} | ${r.standard_number || 'No std'} | Clause: ${r.clause_number}`);
    console.log(`  Sample: ${r.text.replace(/\s+/g, ' ').slice(0, 140)}...`);
  }
  await p.end();
}

test().catch(console.error);
