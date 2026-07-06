import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "..");

export interface Settings {
  spreadsheetId: string;
  worksheetName: string;
  headerRow: number;
  googleCredentialsPath: string;
  baseUrl: string;
  loginEndpoint: string;
  email: string;
  password: string;
  writeResults: boolean;
  outputDir: string;
  reportHtmlPath: string;
  testCategories: string[];
  loginUrl: string;
  testCategoriesLabel: string;
  sheetColumns: {
    testId: string;
    fallbackTestId: string;
    category: string;
    endpointColumns: string[];
    queryParameterColumns: string[];
    testData: string;
    expectedResult: string;
    readStatus: string;
    apiStatus: string;
    writeApiStatus: string;
    writeCommentBackend: string;
  };
  sheetWriteTargets: {
    apiStatus: boolean;
    commentBackend: boolean;
  };
}

export function loadSettings(envPath?: string): Settings {
  const resolvedEnvPath = envPath ?? path.join(PROJECT_ROOT, ".env");
  config({ path: resolvedEnvPath, override: true });

  const credentials = process.env.GOOGLE_CREDENTIALS_PATH ?? "credentials/service-account.json";
  const credPath = path.isAbsolute(credentials)
    ? credentials
    : path.join(PROJECT_ROOT, credentials);

  const testCategories = parseCategories(process.env.TEST_CATEGORIES ?? "API,Both");
  const baseUrl = (process.env.BASE_URL ?? "").replace(/\/$/, "");
  const loginEndpoint = process.env.LOGIN_ENDPOINT ?? "/auth/login";

  return {
    spreadsheetId: requireEnv("SPREADSHEET_ID"),
    worksheetName: parseEnvString(process.env.WORKSHEET_NAME, "Sign In"),
    headerRow: Number(process.env.HEADER_ROW ?? "5"),
    googleCredentialsPath: credPath,
    baseUrl,
    loginEndpoint,
    email: (process.env.EMAIL ?? "").trim(),
    password: (process.env.PASSWORD ?? "").trim(),
    writeResults: ["1", "true", "yes"].includes(
      (process.env.WRITE_RESULTS ?? "false").toLowerCase()
    ),
    outputDir: path.join(PROJECT_ROOT, "output"),
    reportHtmlPath: resolveOutputPath(process.env.REPORT_HTML_PATH ?? "output/report.html"),
    testCategories,
    loginUrl: `${baseUrl}${loginEndpoint}`,
    testCategoriesLabel: testCategories.join(", "),
    sheetColumns: {
      testId: (process.env.SHEET_COL_TEST_ID ?? "Test Case ID").trim(),
      fallbackTestId: (process.env.SHEET_COL_TEST_ID_FALLBACK ?? "Test Scenario").trim(),
      category: (process.env.SHEET_COL_CATEGORY ?? "Category").trim(),
      endpointColumns: endpointColumnCandidates(),
      queryParameterColumns: queryParameterColumnCandidates(),
      testData: (process.env.SHEET_COL_TEST_DATA ?? "Test Data").trim(),
      expectedResult: (process.env.SHEET_COL_EXPECTED_RESULT ?? "Expected Result").trim(),
      readStatus: (process.env.SHEET_COL_STATUS ?? "Status").trim(),
      apiStatus: (process.env.SHEET_COL_API_STATUS ?? "API Status").trim(),
      writeApiStatus: (process.env.SHEET_COL_API_STATUS ?? "API Status").trim(),
      writeCommentBackend: (
        process.env.SHEET_COL_COMMENT_BACKEND ??
        process.env.SHEET_COL_COMMENT ??
        "Comment"
      ).trim(),
    },
    sheetWriteTargets: parseSheetWriteTargets(process.env.SHEET_WRITE_COLUMNS),
  };
}

export function requireLoginCredentials(settings: Settings): void {
  const missing: string[] = [];
  if (!settings.email) missing.push("EMAIL");
  if (!settings.password) missing.push("PASSWORD");
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

export function parseEnvString(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function resolveOutputPath(value: string): string {
  const trimmed = value.trim();
  return path.isAbsolute(trimmed) ? trimmed : path.join(PROJECT_ROOT, trimmed);
}

function parseCategories(raw: string): string[] {
  const categories = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return categories.length ? categories : ["API", "Both"];
}

function endpointColumnCandidates(): string[] {
  const primary = (process.env.SHEET_COL_ENDPOINT ?? "API Endpoint").trim();
  const fallbacks = (process.env.SHEET_COL_ENDPOINT_FALLBACK ?? "Endpoint")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set([primary, ...fallbacks].filter(Boolean))];
}

function queryParameterColumnCandidates(): string[] {
  const primary = (process.env.SHEET_COL_QUERY_PARAMS ?? "Query Parameter").trim();
  const fallbacks = (process.env.SHEET_COL_QUERY_PARAMS_FALLBACK ?? "Query Parameters,Query Params")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set([primary, ...fallbacks].filter(Boolean))];
}

function parseSheetWriteTargets(raw?: string): Settings["sheetWriteTargets"] {
  const defaults = {
    apiStatus: true,
    commentBackend: true,
  };

  if (!raw || !raw.trim()) return defaults;

  const keys = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const toFlag = new Set(keys);
  return {
    apiStatus: toFlag.has("api_status"),
    commentBackend: toFlag.has("comment_backend"),
  };
}

function requireEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
