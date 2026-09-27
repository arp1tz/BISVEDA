const fs = require('fs');
const path = require('path');

const candidates = [
  path.resolve(__dirname, 'data/bisveda_local_db.json'),
  path.resolve(__dirname, '../data/bisveda_local_db.json'),
];

let p = candidates.find(c => fs.existsSync(c));
if (!p) {
  console.log('No local db file found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(p, 'utf-8'));

console.log('=== DATA COUNTS IN LOCAL DB ===');
console.log('Documents:', Object.keys(data.documents || {}).length);
console.log('Chunks:', Object.keys(data.chunks || {}).length);
console.log('Standards:', Object.keys(data.standards || {}).length);
console.log('QCOs:', Object.keys(data.qcos || {}).length);
console.log('QCO Standards Links:', (data.qco_standards || []).length);
console.log('Schemes:', Object.keys(data.schemes || {}).length);
console.log('Standard Schemes Links:', (data.standard_schemes || []).length);
console.log('Labs:', Object.keys(data.labs || {}).length);
console.log('Lab Scopes Links:', (data.lab_scopes || []).length);
console.log('Facts:', Object.keys(data.facts || {}).length);
console.log('Document Versions:', Object.keys(data.document_versions || {}).length);
console.log('KG Nodes:', Object.keys(data.kg_nodes || {}).length);
console.log('KG Edges:', (data.kg_edges || []).length);
console.log('Ingestion Jobs:', Object.keys(data.ingestion_jobs || {}).length);

console.log('\n=== DOCUMENT VERSIONS STATUS BREAKDOWN ===');
const versions = Object.values(data.document_versions || {});
const verStatus = {};
versions.forEach(v => {
  verStatus[v.status] = (verStatus[v.status] || 0) + 1;
});
console.log(verStatus);

console.log('\n=== FACTS STATUS BREAKDOWN ===');
const facts = Object.values(data.facts || {});
const factStatus = {};
facts.forEach(f => {
  factStatus[f.status] = (factStatus[f.status] || 0) + 1;
});
console.log(factStatus);

console.log('\n=== KG NODES TYPE BREAKDOWN ===');
const nodes = Object.values(data.kg_nodes || {});
const nodeTypes = {};
nodes.forEach(n => {
  nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
});
console.log(nodeTypes);

console.log('\n=== KG EDGES TYPE & STATUS BREAKDOWN ===');
const edges = data.kg_edges || [];
const edgeTypes = {};
const edgeStatus = {};
edges.forEach(e => {
  edgeTypes[e.type] = (edgeTypes[e.type] || 0) + 1;
  edgeStatus[e.status || 'unknown'] = (edgeStatus[e.status || 'unknown'] || 0) + 1;
});
console.log('Edge Types:', edgeTypes);
console.log('Edge Status:', edgeStatus);
