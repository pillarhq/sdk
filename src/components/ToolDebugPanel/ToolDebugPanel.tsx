/**
 * Tool Debug Panel Component
 *
 * Shows registered tools and allows testing execution.
 * Only rendered when debug: true is passed to Pillar.init()
 *
 * Features:
 * - Searchable list of all registered tools
 * - Tool details with input schema
 * - JSON editor for testing tool execution
 * - Execute button with result display
 */

import { useEffect, useState, useMemo, useCallback } from "preact/hooks";
import toolDebugPanelCSS from "./tool-debug-panel.css";
import { getPillarInstance } from "../../core/instance";
import type { ToolInfo } from "../../core/Pillar";

interface ToolDebugPanelProps {
  /** Called when user wants to close the panel */
  onClose?: () => void;
}

/**
 * Get badge color for tool type
 */
function getTypeBadgeClass(type?: string): string {
  switch (type) {
    case "navigate":
      return "pillar-tool-badge--navigate";
    case "query":
      return "pillar-tool-badge--query";
    case "trigger_tool":
      return "pillar-tool-badge--trigger";
    case "inline_ui":
      return "pillar-tool-badge--inline";
    default:
      return "pillar-tool-badge--default";
  }
}

/**
 * Get source badge label
 */
function getSourceLabel(source: ToolInfo["source"]): string {
  switch (source) {
    case "defined":
      return "defineTool";
    case "registered":
      return "registerTool";
    case "registry":
      return "onTask";
    default:
      return source;
  }
}

/**
 * Generate default input from schema
 */
function generateDefaultInput(
  schema?: ToolInfo["inputSchema"]
): Record<string, unknown> {
  if (!schema?.properties) return {};

  const result: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const propDef = prop as { type?: string; default?: unknown; enum?: string[] };
    if (propDef.default !== undefined) {
      result[key] = propDef.default;
    } else if (propDef.enum && propDef.enum.length > 0) {
      result[key] = propDef.enum[0];
    } else {
      switch (propDef.type) {
        case "string":
          result[key] = "";
          break;
        case "number":
          result[key] = 0;
          break;
        case "boolean":
          result[key] = false;
          break;
        case "array":
          result[key] = [];
          break;
        case "object":
          result[key] = {};
          break;
        default:
          result[key] = null;
      }
    }
  }
  return result;
}

/**
 * Tool Debug Panel Component
 */
export function ToolDebugPanel({ onClose }: ToolDebugPanelProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);
  const [inputJson, setInputJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    result?: unknown;
    error?: string;
  } | null>(null);

  // Inject styles on mount
  useEffect(() => {
    const styleId = "pillar-tool-debug-panel-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = toolDebugPanelCSS;
      document.head.appendChild(style);
    }
  }, []);

  // Load tools and subscribe to changes
  useEffect(() => {
    const pillar = getPillarInstance();
    if (!pillar) return;

    // Initial load
    setTools(pillar.getTools());

    // Subscribe to tool changes
    const unsubscribe = pillar.on("tools:change", (event: { action: string; name: string }) => {
      const currentTools = pillar.getTools();
      setTools(currentTools);
      
      // If a tool was removed, check if it was the selected one
      if (event.action === "remove") {
        setSelectedTool((prev) => {
          if (prev && prev.name === event.name) {
            setExecutionResult(null);
            return null;
          }
          return prev;
        });
      }
    });

    return unsubscribe;
  }, []);

  // Filter tools based on search
  const filteredTools = useMemo(() => {
    if (!searchFilter) return tools;
    const lower = searchFilter.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.type?.toLowerCase().includes(lower)
    );
  }, [tools, searchFilter]);

  // Handle tool selection
  const handleSelectTool = useCallback((tool: ToolInfo) => {
    setSelectedTool(tool);
    setExecutionResult(null);
    const defaultInput = generateDefaultInput(tool.inputSchema);
    setInputJson(JSON.stringify(defaultInput, null, 2));
    setJsonError(null);
  }, []);

  // Validate JSON input
  const handleInputChange = useCallback((value: string) => {
    setInputJson(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, []);

  // Execute tool
  const handleExecute = useCallback(async () => {
    if (!selectedTool || jsonError) return;

    const pillar = getPillarInstance();
    if (!pillar) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const input = JSON.parse(inputJson);
      const result = await pillar.executeToolForDebug(selectedTool.name, input);
      setExecutionResult(result);
    } catch (e) {
      setExecutionResult({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedTool, inputJson, jsonError]);

  // Refresh tools list
  const handleRefresh = useCallback(() => {
    const pillar = getPillarInstance();
    if (pillar) {
      setTools(pillar.getTools());
    }
  }, []);

  return (
    <div class="pillar-tool-debug-panel">
      {/* Header */}
      <div class="pillar-tool-debug-header">
        <h2 class="pillar-tool-debug-title">Tool Debugger</h2>
        <div class="pillar-tool-debug-header-actions">
          <button
            class="pillar-tool-debug-btn"
            onClick={handleRefresh}
            title="Refresh tools list"
          >
            Refresh
          </button>
          {onClose && (
            <button class="pillar-tool-debug-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      <div class="pillar-tool-debug-content">
        {/* Tool List */}
        <div class="pillar-tool-debug-list">
          <div class="pillar-tool-debug-search">
            <input
              type="text"
              class="pillar-tool-debug-search-input"
              placeholder="Search tools..."
              value={searchFilter}
              onInput={(e) =>
                setSearchFilter((e.target as HTMLInputElement).value)
              }
            />
            <span class="pillar-tool-debug-count">
              {filteredTools.length} tool{filteredTools.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div class="pillar-tool-debug-tools">
            {filteredTools.length === 0 ? (
              <div class="pillar-tool-debug-empty">
                {tools.length === 0
                  ? "No tools registered"
                  : "No tools match your search"}
              </div>
            ) : (
              filteredTools.map((tool) => (
                <button
                  key={tool.name}
                  class={`pillar-tool-debug-tool-item ${
                    selectedTool?.name === tool.name
                      ? "pillar-tool-debug-tool-item--selected"
                      : ""
                  }`}
                  onClick={() => handleSelectTool(tool)}
                >
                  <div class="pillar-tool-debug-tool-header">
                    <span class="pillar-tool-debug-tool-name">{tool.name}</span>
                    {tool.type && (
                      <span
                        class={`pillar-tool-badge ${getTypeBadgeClass(
                          tool.type
                        )}`}
                      >
                        {tool.type}
                      </span>
                    )}
                  </div>
                  <div class="pillar-tool-debug-tool-desc">
                    {tool.description || "No description"}
                  </div>
                  <div class="pillar-tool-debug-tool-meta">
                    <span class="pillar-tool-source">
                      {getSourceLabel(tool.source)}
                    </span>
                    {tool.hasHandler ? (
                      <span class="pillar-tool-handler pillar-tool-handler--active">
                        handler
                      </span>
                    ) : (
                      <span class="pillar-tool-handler">no handler</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Tool Detail */}
        <div class="pillar-tool-debug-detail">
          {selectedTool ? (
            <>
              <div class="pillar-tool-debug-detail-header">
                <h3 class="pillar-tool-debug-detail-name">
                  {selectedTool.name}
                </h3>
                {selectedTool.type && (
                  <span
                    class={`pillar-tool-badge ${getTypeBadgeClass(
                      selectedTool.type
                    )}`}
                  >
                    {selectedTool.type}
                  </span>
                )}
              </div>

              <p class="pillar-tool-debug-detail-desc">
                {selectedTool.description || "No description provided"}
              </p>

              {/* Input Schema */}
              {selectedTool.inputSchema && (
                <div class="pillar-tool-debug-schema">
                  <h4 class="pillar-tool-debug-section-title">Input Schema</h4>
                  <pre class="pillar-tool-debug-schema-content">
                    {JSON.stringify(selectedTool.inputSchema, null, 2)}
                  </pre>
                </div>
              )}

              {/* JSON Input Editor */}
              <div class="pillar-tool-debug-input">
                <h4 class="pillar-tool-debug-section-title">Input Parameters</h4>
                <textarea
                  class={`pillar-tool-debug-textarea ${
                    jsonError ? "pillar-tool-debug-textarea--error" : ""
                  }`}
                  value={inputJson}
                  onInput={(e) =>
                    handleInputChange((e.target as HTMLTextAreaElement).value)
                  }
                  rows={8}
                  spellcheck={false}
                />
                {jsonError && (
                  <div class="pillar-tool-debug-json-error">{jsonError}</div>
                )}
              </div>

              {/* Execute Button */}
              <div class="pillar-tool-debug-actions">
                <button
                  class="pillar-tool-debug-execute-btn"
                  onClick={handleExecute}
                  disabled={
                    isExecuting || !!jsonError || !selectedTool.hasHandler
                  }
                >
                  {isExecuting ? "Executing..." : "Execute Tool"}
                </button>
                {!selectedTool.hasHandler && (
                  <span class="pillar-tool-debug-no-handler">
                    No handler registered
                  </span>
                )}
              </div>

              {/* Execution Result */}
              {executionResult && (
                <div
                  class={`pillar-tool-debug-result ${
                    executionResult.success
                      ? "pillar-tool-debug-result--success"
                      : "pillar-tool-debug-result--error"
                  }`}
                >
                  <h4 class="pillar-tool-debug-section-title">
                    {executionResult.success ? "Result" : "Error"}
                  </h4>
                  <pre class="pillar-tool-debug-result-content">
                    {executionResult.success
                      ? JSON.stringify(executionResult.result, null, 2) ||
                        "undefined"
                      : executionResult.error}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div class="pillar-tool-debug-no-selection">
              <p>Select a tool from the list to view details and test execution</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ToolDebugPanel;
