/**
 * Normalize a tool handler's return value into the payload sent to the backend.
 *
 * Accepted handler return shapes:
 *   { success: true,  data: { ... } }  → returns the data object
 *   { success: false, error: "..." }   → forwarded as-is (backend reads error)
 *   { key: "val", ... }                → passed through unchanged
 *   "string" / number / array          → passed through unchanged
 */
export function normalizeToolResult(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const obj = raw as Record<string, unknown>;

  if (obj.success === false) {
    return { success: false, error: obj.error || obj.message || "Action failed" };
  }

  if ("data" in obj && obj.data != null && typeof obj.data === "object") {
    return obj.data;
  }

  return raw;
}
