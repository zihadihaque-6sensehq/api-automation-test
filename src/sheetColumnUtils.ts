export function pickRecordField(
  record: Record<string, string>,
  columnNames: string[]
): string {
  for (const name of columnNames) {
    const value = (record[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}
