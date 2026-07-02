import type { TestCase } from "./sheetClient.js";

const COLUMN_ALIASES: Record<string, string> = {
  "Test Scenario": "test_scenario",
  "Test Case ID": "test_case_id",
  "Test Type": "test_type",
  "Test Case": "test_case",
  "Pre-Conditions": "pre_conditions",
  "Test Steps": "test_steps",
  "Test Data": "test_data",
  "Expected Result": "expected_result",
  Category: "category",
  Status: "status",
  "API Automation": "api_automation",
  Playwright: "playwright",
  Comment: "comment",
};

export function testCasesToObjects(tests: TestCase[]): Record<string, unknown>[] {
  return tests.map(testCaseToObject);
}

export function testCaseToObject(test: TestCase): Record<string, unknown> {
  const obj: Record<string, unknown> = { row: test.rowNumber };

  for (const [column, value] of Object.entries(test.raw)) {
    const key = COLUMN_ALIASES[column] ?? toSnakeCase(column);
    obj[key] = value || null;
  }

  return obj;
}

function toSnakeCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
