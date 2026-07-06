import fs from "fs";
import { google } from "googleapis";
import type { Settings } from "./config.js";
import { pickRecordField } from "./sheetColumnUtils.js";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export interface TestCase {
  rowNumber: number;
  testId: string;
  category: string;
  endpoint: string;
  queryParameters: string;
  testData: string;
  expectedResult: string;
  apiStatus: string;
  status: string;
  raw: Record<string, string>;
}

function queueStatusValues(): Set<string> {
  const raw =
    process.env.AGENT_QUEUE_API_STATUSES ??
    "Not_implemented,Not Implemented,not_implemented,Not-implemented";
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeApiStatus(value: string): string {
  return (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isQueuedApiTest(apiStatus: string): boolean {
  const trimmed = (apiStatus || "").trim();
  if (!trimmed) return true;

  const normalized = trimmed.toLowerCase();
  const slug = normalizeApiStatus(trimmed);

  if (queueStatusValues().has(normalized)) return true;
  if (slug === "not_implemented") return true;

  return false;
}

export function isBackendCategory(category: string, allowed: string[]): boolean {
  const normalized = category.trim().toLowerCase();
  const allowedSet = new Set(allowed.map((value) => value.trim().toLowerCase()));
  return allowedSet.has(normalized);
}

export class SheetClient {
  private settings: Settings;
  private cachedRows: string[][] | null = null;
  private headerMapCache: Record<string, number> | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  async connect(): Promise<Record<string, unknown>> {
    const rows = await this.getRows();
    const headers = await this.headerMap();
    return {
      spreadsheet_id: this.settings.spreadsheetId,
      worksheet: this.settings.worksheetName,
      header_row: this.settings.headerRow,
      columns: Object.keys(headers),
      row_count: rows.length,
    };
  }

  async listWorksheets(): Promise<string[]> {
    const sheets = await this.getSheetsApi();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: this.settings.spreadsheetId,
      fields: "sheets.properties.title",
    });

    return (response.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title?.trim() ?? "")
      .filter(Boolean);
  }

  async fetchAllTests(): Promise<TestCase[]> {
    const rows = await this.getRows();
    const records = recordsFromRows(rows, this.settings.headerRow);
    const tests: TestCase[] = [];

    records.forEach((record, index) => {
      const testId =
        record[this.settings.sheetColumns.testId] ??
        record[this.settings.sheetColumns.fallbackTestId] ??
        "";
      if (!testId) return;

      tests.push({
        rowNumber: this.settings.headerRow + index + 1,
        testId,
        category: record[this.settings.sheetColumns.category] ?? "",
        endpoint: pickRecordField(record, this.settings.sheetColumns.endpointColumns),
        queryParameters: pickRecordField(
          record,
          this.settings.sheetColumns.queryParameterColumns
        ),
        testData: record[this.settings.sheetColumns.testData] ?? "",
        expectedResult: record[this.settings.sheetColumns.expectedResult] ?? "",
        apiStatus: record[this.settings.sheetColumns.apiStatus] ?? "",
        status: record[this.settings.sheetColumns.readStatus] ?? "",
        raw: record,
      });
    });

    return tests;
  }

  async fetchApiTests(): Promise<TestCase[]> {
    const all = await this.fetchAllTests();
    return all.filter((test) =>
      isBackendCategory(test.category, this.settings.testCategories)
    );
  }

  async fetchPendingApiTests(processAll = false): Promise<TestCase[]> {
    const apiTests = await this.fetchApiTests();
    if (processAll) return apiTests;
    return apiTests.filter((test) => isQueuedApiTest(test.apiStatus));
  }

  async getWorksheetRows(worksheetName: string): Promise<string[][]> {
    const sheets = await this.getSheetsApi();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.settings.spreadsheetId,
      range: quoteWorksheetName(worksheetName),
    });
    return response.data.values ?? [];
  }

  async countSkippedNonBackendTests(): Promise<number> {
    const all = await this.fetchAllTests();
    return all.filter(
      (test) => !isBackendCategory(test.category, this.settings.testCategories)
    ).length;
  }

  async updateApiTestResult(
    rowNumber: number,
    passed: boolean,
    failures: string[]
  ): Promise<void> {
    const headers = await this.headerMap();

    const apiStatus = passed ? "Passed" : "Failed";
    const commentBackend = passed ? "N/A" : failures.join("; ");
    const data: Array<{ range: string; values: string[][] }> = [];

    if (this.settings.sheetWriteTargets.apiStatus) {
      const apiStatusCol = findColumn(headers, this.settings.sheetColumns.writeApiStatus);
      data.push({
        range: sheetCellRange(this.settings.worksheetName, apiStatusCol, rowNumber),
        values: [[apiStatus]],
      });
    }

    if (this.settings.sheetWriteTargets.commentBackend) {
      const commentBackendCol = findColumnOptional(headers, [
        this.settings.sheetColumns.writeCommentBackend,
        "Comment",
        "Comment - Backend",
        "Backend Comment",
      ]);
      if (commentBackendCol) {
        data.push({
          range: sheetCellRange(this.settings.worksheetName, commentBackendCol, rowNumber),
          values: [[commentBackend]],
        });
      } else {
        console.warn(
          `Column "${this.settings.sheetColumns.writeCommentBackend}" not found on "${this.settings.worksheetName}"; skipping comment write.`
        );
      }
    }

    if (!data.length) {
      console.log(
        "SHEET_WRITE_COLUMNS is empty or invalid; no Google Sheet columns were updated."
      );
      return;
    }

    const sheets = await this.getSheetsApi();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.settings.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data,
      },
    });
  }

  /** @deprecated Use updateApiTestResult — sheet has no Status column */
  async updateStatus(rowNumber: number, status: string): Promise<void> {
    const passed = status.toLowerCase() === "pass";
    await this.updateApiTestResult(rowNumber, passed, passed ? [] : [status]);
  }

  private async headerMap(): Promise<Record<string, number>> {
    if (this.headerMapCache) return this.headerMapCache;

    const rows = await this.getRows();
    const headerValues = rows[this.settings.headerRow - 1] ?? [];
    const map: Record<string, number> = {};

    headerValues.forEach((name, index) => {
      const trimmed = name.trim();
      if (trimmed) map[trimmed] = index + 1;
    });

    this.headerMapCache = map;
    return map;
  }

  private async getRows(): Promise<string[][]> {
    if (this.cachedRows) return this.cachedRows;

    const sheets = await this.getSheetsApi();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.settings.spreadsheetId,
      range: quoteWorksheetName(this.settings.worksheetName),
    });

    this.cachedRows = response.data.values ?? [];
    return this.cachedRows;
  }

  private async getSheetsApi() {
    if (!fs.existsSync(this.settings.googleCredentialsPath)) {
      throw new Error(`Credentials file not found: ${this.settings.googleCredentialsPath}`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: this.settings.googleCredentialsPath,
      scopes: SCOPES,
    });

    return google.sheets({ version: "v4", auth });
  }
}

function recordsFromRows(rows: string[][], headerRow: number): Record<string, string>[] {
  const headerIndex = headerRow - 1;
  const headers = (rows[headerIndex] ?? []).map((value) => value.trim());
  const records: Record<string, string>[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (row[index] ?? "").trim();
    });
    records.push(record);
  }

  return records;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function findColumnOptional(
  headers: Record<string, number>,
  candidates: string[]
): number | null {
  for (const name of candidates) {
    if (!name) continue;
    try {
      return findColumn(headers, name);
    } catch {
      // try next alias
    }
  }
  return null;
}

function findColumn(headers: Record<string, number>, name: string): number {
  const exact = headers[name];
  if (exact) return exact;

  const target = name.trim().toLowerCase();
  for (const [header, column] of Object.entries(headers)) {
    if (header.trim().toLowerCase() === target) return column;
  }

  throw new Error(`Column "${name}" not found in worksheet header row`);
}

function requireColumn(headers: Record<string, number>, name: string): number {
  return findColumn(headers, name);
}

function quoteWorksheetName(worksheetName: string): string {
  if (worksheetName.includes(" ") || worksheetName.includes("'")) {
    return `'${worksheetName.replace(/'/g, "''")}'`;
  }
  return worksheetName;
}

function sheetCellRange(worksheetName: string, columnNumber: number, rowNumber: number): string {
  return `${quoteWorksheetName(worksheetName)}!${columnLetter(columnNumber - 1)}${rowNumber}`;
}
