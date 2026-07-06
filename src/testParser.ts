const PLACEHOLDER_PATTERN = /\{\{?\s*(\w+)\s*\}?\}|\$\{(\w+)\}/g;
const WRONG_PASSWORD = "WrongPass123!";

export interface ExpectedAssertions {
  status: number | null;
  error: string | null;
  token: string | null;
  acceptStatuses: number[];
}

export function buildLoginPayload(
  testData: string,
  env: Record<string, string>
): Record<string, string> {
  const parsed = parseCell(testData);
  const payload: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey === "emailAddress" || normalizedKey === "password") {
      payload[normalizedKey] = resolveValue(String(value), env, normalizedKey);
    }
  }

  if (Object.keys(payload).length > 0) {
    return payload;
  }

  return buildFromNaturalLanguage(testData, env);
}

export function parseExpectedResult(expectedResult: string): ExpectedAssertions {
  const parsed = parseCell(expectedResult);
  let status: number | null = null;
  let error: string | null = null;
  let token: string | null = null;
  const acceptStatuses: number[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const lowered = key.toLowerCase().replace(/\s/g, "");
    const text = String(value).trim();

    if (["status", "statuscode", "httpstatus"].includes(lowered)) {
      const digits = text.replace(/\D/g, "");
      status = digits ? Number(digits) : null;
    } else if (["error", "errors", "message", "errormessage"].includes(lowered)) {
      error = text;
    } else if (lowered === "token") {
      token = text.toLowerCase();
    }
  }

  if (status === null && error === null && token === null) {
    return parseNaturalExpected(expectedResult);
  }

  return { status, error, token, acceptStatuses };
}

function buildFromNaturalLanguage(
  text: string,
  env: Record<string, string>
): Record<string, string> {
  const lowered = (text || "").toLowerCase();
  let email = env.EMAIL ?? "";
  let password = env.PASSWORD ?? "";

  const emailMatch = text.match(/email:\s*([^,]+)/i);
  const passwordMatch = text.match(/password:\s*([^,]+)/i);

  if (emailMatch) {
    const emailValue = emailMatch[1].trim().replace(/^"|"$/g, "");
    if (emailValue.toLowerCase() === "empty") email = "";
    else if (["valid", "registered email"].includes(emailValue.toLowerCase())) {
      email = env.EMAIL ?? "";
    } else email = emailValue;
  }

  if (passwordMatch) {
    const passwordValue = passwordMatch[1].trim().replace(/^"|"$/g, "");
    if (passwordValue.toLowerCase() === "empty") password = "";
    else if (passwordValue.toLowerCase() === "valid") password = env.PASSWORD ?? "";
    else password = passwordValue;
  }

  if (lowered.includes("invalid email/password") || lowered.includes("wrong credentials")) {
    return { emailAddress: "invalid@example.com", password: WRONG_PASSWORD };
  }
  if (lowered.includes("unregistered")) {
    return {
      emailAddress: "unregistered_user@example.com",
      password: password || WRONG_PASSWORD,
    };
  }
  if (lowered.includes("wrong password")) {
    return { emailAddress: email, password: WRONG_PASSWORD };
  }
  if (lowered.includes("testgmail.com")) {
    return { emailAddress: "testgmail.com", password };
  }
  if (lowered.includes("both") && lowered.includes("empty")) {
    return { emailAddress: "", password: "" };
  }
  if (/email:\s*empty/i.test(lowered)) {
    return { emailAddress: "", password };
  }
  if (/password:\s*empty/i.test(lowered)) {
    return { emailAddress: email, password: "" };
  }
  if (lowered.includes("spaces") || /"\s*.+@.+\s*"/.test(text)) {
    return { emailAddress: ` ${email} `, password };
  }

  return { emailAddress: email, password };
}

function parseNaturalExpected(text: string): ExpectedAssertions {
  const lowered = (text || "").toLowerCase();

  const statusCodePhrase = lowered.match(/status code should be (\d{3})/);
  if (statusCodePhrase) {
    return {
      status: Number(statusCodePhrase[1]),
      error: null,
      token: null,
      acceptStatuses: [],
    };
  }

  const shouldBeStatus = lowered.match(/should be (\d{3})\s*ok\b/);
  if (shouldBeStatus) {
    return {
      status: Number(shouldBeStatus[1]),
      error: null,
      token: null,
      acceptStatuses: [],
    };
  }

  if (/\b200\s*ok\b/.test(lowered) || lowered.includes("status code 200")) {
    return { status: 200, error: null, token: null, acceptStatuses: [] };
  }

  if (/\b201\s*created\b/.test(lowered) || lowered.includes("status code 201")) {
    return { status: 201, error: null, token: null, acceptStatuses: [] };
  }

  if (
    [
      "signed in successfully",
      "success response",
      "token",
      "signed in",
      "process login correctly",
    ].some((phrase) => lowered.includes(phrase))
  ) {
    return { status: null, error: null, token: "present", acceptStatuses: [200, 201] };
  }

  if (lowered.includes("invalid email format")) {
    return { status: null, error: "email", token: "absent", acceptStatuses: [400, 422] };
  }

  if (["user not found", "does not exist"].some((phrase) => lowered.includes(phrase))) {
    return {
      status: null,
      error: "exist|not found",
      token: "absent",
      acceptStatuses: [400, 401, 403, 404],
    };
  }

  if (
    ["invalid credentials", "unauthorized", "wrong credentials"].some((phrase) =>
      lowered.includes(phrase)
    )
  ) {
    return {
      status: null,
      error: "credential|invalid|unauthorized|exist|not found",
      token: "absent",
      acceptStatuses: [400, 401, 403],
    };
  }

  if (
    ["login should fail", "should fail", "error message"].some((phrase) =>
      lowered.includes(phrase)
    )
  ) {
    return { status: null, error: null, token: "absent", acceptStatuses: [400, 401, 403] };
  }

  return { status: null, error: null, token: null, acceptStatuses: [] };
}

function parseCell(raw: string): Record<string, string> {
  const text = (raw || "").trim();
  if (!text) return {};

  const attempts = [text];
  if (!text.startsWith("{") && /["']?[\w]+\s*["']?\s*:/.test(text)) {
    attempts.push(`{${text}}`);
  }

  for (const candidate of attempts) {
    try {
      const data = JSON.parse(candidate) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return Object.fromEntries(
          Object.entries(data as Record<string, unknown>).map(([k, v]) => [
            normalizeKey(k),
            String(v).replace(/^"|"$/g, "").replace(/,\s*$/, "").trim(),
          ])
        );
      }
    } catch {
      // try next
    }
  }

  const parts = /,\s*["']?[\w]+\s*["']?\s*:/.test(text)
    ? text.split(/,\s*(?=["']?[\w]+\s*["']?\s*:)/)
    : text.split(/\r?\n/).length ? text.split(/\r?\n/) : [text];

  const result: Record<string, string> = {};
  for (const part of parts) {
    const trimmed = part.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) continue;
    if (trimmed.includes(":")) {
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      result[normalizeKey(key)] = value.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/,\s*$/, "").trim();
    } else if (trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      result[normalizeKey(key)] = rest.join("=").trim();
    }
  }

  return result;
}

function resolveValue(value: string, env: Record<string, string>, field = ""): string {
  const text = value.trim();
  if (text.toLowerCase() === "empty") return "";
  if (
    field === "emailAddress" &&
    ["valid", "valid email", "registered email"].includes(text.toLowerCase())
  ) {
    return env.EMAIL ?? text;
  }
  if (
    field === "password" &&
    ["valid", "valid password", "registered password"].includes(text.toLowerCase())
  ) {
    return env.PASSWORD ?? text;
  }
  if (["valid email", "registered email"].includes(text.toLowerCase())) {
    return env.EMAIL ?? text;
  }
  if (["valid password", "registered password"].includes(text.toLowerCase())) {
    return env.PASSWORD ?? text;
  }

  const resolved = text.replace(PLACEHOLDER_PATTERN, (match, g1, g2) => {
    const key = g1 || g2;
    if (env[key]) return env[key];
    if (env[key.toUpperCase()]) return env[key.toUpperCase()];
    return match;
  });

  if (env[resolved]) return env[resolved];
  if (env[resolved.toUpperCase()]) return env[resolved.toUpperCase()];
  return resolved;
}

function normalizeKey(key: string): string {
  const lowered = key.trim().toLowerCase().replace(/\s/g, "");
  if (["email", "emailaddress", "email_address"].includes(lowered)) return "emailAddress";
  if (lowered === "password") return "password";
  return key.trim();
}
