/**
 * Verify backend and AI by fetching key endpoints.
 * Run from repo root: node backend/scripts/fetch-verify-endpoints.js
 * Requires backend running on PORT (default 4000).
 */
const http = require("http");

const PORT = process.env.PORT || 4000;
const BASE = `http://localhost:${PORT}`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 8000 }, (res) => {
      let body = "";
      res.on("data", (ch) => (body += ch));
      res.on("end", () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function main() {
  console.log("MenyAI endpoint verification\n");
  const results = { ok: [], fail: [] };

  // Health
  try {
    const r = await fetch(`${BASE}/health`);
    if (r.status === 200 && r.data.status === "ok") {
      results.ok.push(`GET /health → ${r.status} (firebase: ${r.data.firebase})`);
    } else {
      results.fail.push(`GET /health → ${r.status} ${JSON.stringify(r.data)}`);
    }
  } catch (e) {
    results.fail.push(`GET /health → ${e.message} (is backend running on ${PORT}?)`);
  }

  // AI health
  try {
    const r = await fetch(`${BASE}/api/ai/health`);
    if (r.status === 200 && r.data.configured) {
      results.ok.push(`GET /api/ai/health → configured=true, model=${r.data.model || "n/a"}`);
    } else if (r.status === 503 && !r.data.configured) {
      results.ok.push(`GET /api/ai/health → 503 (AI not configured; set OPENAI_API_KEY to enable)`);
    } else {
      results.fail.push(`GET /api/ai/health → ${r.status} ${JSON.stringify(r.data)}`);
    }
  } catch (e) {
    results.fail.push(`GET /api/ai/health → ${e.message}`);
  }

  // Lessons list (returns { lessons: [...] })
  try {
    const r = await fetch(`${BASE}/api/lessons`);
    const list = r.data?.lessons ?? (Array.isArray(r.data) ? r.data : null);
    if (r.status === 200 && Array.isArray(list)) {
      results.ok.push(`GET /api/lessons → ${r.status} (${list.length} lessons)`);
    } else if (r.status === 401 || r.status === 503) {
      results.ok.push(`GET /api/lessons → ${r.status} (auth or DB required)`);
    } else {
      results.fail.push(`GET /api/lessons → ${r.status}`);
    }
  } catch (e) {
    results.fail.push(`GET /api/lessons → ${e.message}`);
  }

  console.log("OK:", results.ok.length);
  results.ok.forEach((s) => console.log("  ", s));
  if (results.fail.length) {
    console.log("\nFail:", results.fail.length);
    results.fail.forEach((s) => console.log("  ", s));
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
