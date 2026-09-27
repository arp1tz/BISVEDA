const fs = require('fs');
const env = fs.readFileSync('c:/BISVEDA/prototype/.env', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.+)/)[1].trim();
const img = fs.readFileSync('c:/BISVEDA/prototype/example helmet.jpeg').toString('base64');

async function test() {
  const prompt = `Analyze this product photo for Bureau of Indian Standards (BIS) statutory compliance.
1. Read visible text (OCR).
2. Detect if an ISI mark, Standard mark, CRS mark, or Hallmark/HUID is present.
3. Extract Indian Standard code (e.g. "IS 4151", "IS 2347", "IS 9873", "IS 17526", etc.) or null if not detected.
4. Extract CM/L license number or HUID or null if not detected.
5. Identify the product name / product category.
6. Provide an OCR confidence (0.0 to 1.0) and an extraction confidence (0.0 to 1.0) based on image clarity and legibility.

Return strictly JSON with keys:
{
  "is_mark_present": boolean,
  "mark_type": "ISI" | "CRS" | "HALLMARK_HUID" | "NONE" | "SUSPICIOUS",
  "standard_code": string | null,
  "cml_number": string | null,
  "product_name": string,
  "ocr_text": string,
  "ocr_confidence": number,
  "extraction_confidence": number,
  "visual_observations": string
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: img } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    })
  });

  const data = await res.json();
  console.log("Vision result:", data.candidates?.[0]?.content?.parts?.[0]?.text);
}

test().catch(console.error);
