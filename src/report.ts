import fs from "fs";
import path from "path";
import type { TestResult } from "./runner.js";
import { summarize } from "./runner.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function writeHtmlReport(
  results: TestResult[],
  outputPath: string,
  loginUrl: string,
  options: {
    spreadsheetId?: string;
    worksheetName?: string;
    categoriesLabel?: string;
    runner?: string;
  } = {}
): void {
  const summary = summarize(results);
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const passRate = summary.total ? Math.round((summary.passed / summary.total) * 1000) / 10 : 0;
  const rows = results.map(resultRow).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login API QA Report</title>
  <style>
    :root {
      --pass: #047857;
      --fail: #b91c1c;
      --border: #e5e7eb;
      --muted: #6b7280;
      --bg: #f9fafb;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      color: #111827;
      background: #f3f4f6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .header {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: var(--muted); line-height: 1.6; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .card .label { color: var(--muted); font-size: 13px; margin-bottom: 6px; }
    .card .value { font-size: 28px; font-weight: 700; }
    .card.pass .value { color: var(--pass); }
    .card.fail .value { color: var(--fail); }
    .table-wrap {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: auto;
    }
    table { width: 100%; border-collapse: collapse; min-width: 1100px; }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: var(--bg);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #374151;
    }
    tr:last-child td { border-bottom: none; }
    tr.failed { background: #fef2f2; }
    tr.passed { background: #f0fdf4; }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge.pass { background: #d1fae5; color: #065f46; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
    .test-title { font-weight: 600; margin-bottom: 4px; }
    .test-id { color: var(--muted); font-size: 13px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Login API QA Report</h1>
      <div class="meta">
        <div>Scope: backend only — Category: <strong>${escapeHtml(options.categoriesLabel ?? "API, Both")}</strong></div>
        <div>Runner: <code>${escapeHtml(options.runner ?? "Node")}</code></div>
        <div>Endpoint: <code>${escapeHtml(loginUrl)}</code></div>
        <div>Worksheet: <code>${escapeHtml(options.worksheetName ?? "")}</code></div>
        <div>Spreadsheet: <code>${escapeHtml(options.spreadsheetId ?? "")}</code></div>
        <div>Generated: ${escapeHtml(generatedAt)}</div>
      </div>
    </div>

    <div class="summary">
      <div class="card"><div class="label">Total</div><div class="value">${summary.total}</div></div>
      <div class="card pass"><div class="label">Passed</div><div class="value">${summary.passed}</div></div>
      <div class="card fail"><div class="label">Failed</div><div class="value">${summary.failed}</div></div>
      <div class="card"><div class="label">Pass Rate</div><div class="value">${passRate}%</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Category</th>
            <th>Result</th>
            <th>Request</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf-8");
}

function resultRow(result: TestResult): string {
  const statusClass = result.passed ? "passed" : "failed";
  const badgeClass = result.passed ? "pass" : "fail";
  const badgeText = result.passed ? "Pass" : "Fail";
  const details = result.failures.length
    ? result.failures.map(escapeHtml).join("<br>")
    : "—";

  const expectedParts: string[] = [];
  if (result.expected.status !== null) expectedParts.push(`status: ${result.expected.status}`);
  if (result.expected.acceptStatuses.length) {
    expectedParts.push(`status in: ${result.expected.acceptStatuses.join(", ")}`);
  }
  if (result.expected.error) expectedParts.push(`error contains: ${result.expected.error}`);
  if (result.expected.token) expectedParts.push(`token: ${result.expected.token}`);
  expectedParts.push(`sheet: ${result.testCase.expectedResult}`);
  const expectedText = expectedParts.join("\n");

  const actualParts = [`HTTP ${result.response.statusCode}`];
  if (result.response.error) actualParts.push(result.response.error);
  else if (result.response.body !== null && result.response.body !== undefined) {
    actualParts.push(
      typeof result.response.body === "string"
        ? result.response.body
        : JSON.stringify(result.response.body)
    );
  }
  const actualText = actualParts.join("\n");
  const testTitle = result.testCase.raw["Test Case"] ?? "";
  const hoppscotchId = result.hoppscotchRequestId
    ? `\n          <div class="test-id">Hoppscotch: ${escapeHtml(result.hoppscotchRequestId)}</div>`
    : "";

  return `
      <tr class="${statusClass}">
        <td>
          <div class="test-title">${escapeHtml(testTitle)}</div>
          <div class="test-id">${escapeHtml(result.testCase.testId)} · row ${result.testCase.rowNumber}</div>${hoppscotchId}
        </td>
        <td>${escapeHtml(result.testCase.category)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td><pre>${escapeHtml(JSON.stringify(result.payload))}</pre></td>
        <td><pre>${escapeHtml(expectedText)}</pre></td>
        <td><pre>${escapeHtml(actualText)}</pre></td>
        <td>${details}</td>
      </tr>`;
}
