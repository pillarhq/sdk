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
  // Void handlers (navigate, open_modal, etc.) return undefined/null.
  // Always send a concrete payload so the backend doesn't confuse it with a timeout.
  if (raw == null) {
    return { success: true };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const obj = raw as Record<string, unknown>;

  if (obj.success === false) {
    return { success: false, error: obj.error || obj.message || "Action failed" };
  }

  // Structured result with summary/actions — pass through as-is so the
  // backend receives the full shape (summary, data, actions).
  if (("summary" in obj || "actions" in obj) && "data" in obj) {
    return raw;
  }

  // Legacy { success: true, data: {...} } envelope — unwrap to just data.
  if ("data" in obj && obj.data != null && typeof obj.data === "object") {
    return obj.data;
  }

  return raw;
}
