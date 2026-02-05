/**
 * Panel Content Component
 * Main panel layout with header, content, and chat input
 */

import { activeTab } from "../../store/panel";
import { currentView, type ViewType } from "../../store/router";
import { ChatView, HomeView } from "../Views";
import { Header } from "./Header";
import { UnifiedChatInput } from "./UnifiedChatInput";

export function PanelContent() {
  const view = currentView.value;
  const currentTab = activeTab.value;

  // Check if we're in a chat view (chat views have their own input)
  // Also check if we're on home view (home view has its own input)
  const isChatView = view.type === "chat";
  const isHomeView = view.type === "home";

  // Render content for non-assistant tabs
  const renderTabContent = () => {
    switch (currentTab) {
      case "support":
        return (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "8px",
              }}
            >
              Hello World
            </h2>
            <p style={{ color: "var(--pillar-text-muted)", fontSize: "14px" }}>
              Support tab content goes here.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  // Render the appropriate assistant view
  const renderAssistantView = () => {
    switch (view.type) {
      case "home":
        return <HomeView />;
      case "chat":
        return <ChatView />;
      default:
        return <HomeView />;
    }
  };

  // For non-assistant tabs, show the tab content
  if (currentTab !== "assistant") {
    return (
      <div class="_pillar-panel-ui pillar-panel-ui">
        <Header currentView="home" />
        <div class="_pillar-content pillar-content">{renderTabContent()}</div>
      </div>
    );
  }

  // Assistant tab - show normal views with chat input
  return (
    <div class="_pillar-panel-ui pillar-panel-ui">
      <Header currentView={view.type as ViewType} hideNavigation={isChatView} />
      <div class="_pillar-content pillar-content">{renderAssistantView()}</div>
      {!isChatView && !isHomeView && (
        <div class="_pillar-chat-input-area pillar-chat-input-area">
          <UnifiedChatInput placeholder="Ask a question..." />
        </div>
      )}
    </div>
  );
}
