/**
 * Panel Styles Aggregator
 * Imports all CSS files that are injected into the Panel (Shadow DOM or head)
 * and exports them as a single concatenated string.
 */

import confirmCard from "../components/Cards/confirm-action-card.css";
import chatInput from "../components/Panel/chat-input.css";
import contextTag from "../components/Panel/context-tag.css";
import header from "../components/Panel/header.css";
import panel from "../components/Panel/panel.css";
import taskButton from "../components/Panel/task-button.css";
import unifiedInput from "../components/Panel/unified-chat-input.css";
import workflow from "../components/Panel/workflow-checklist.css";
import progress from "../components/Progress/progress.css";
import chatView from "../components/Views/chat-view.css";
import homeView from "../components/Views/home-view.css";
import resumePrompt from "../components/Views/resume-prompt.css";
import loading from "../components/shared/loading.css";
import questionChip from "../components/shared/question-chip.css";
import markdown from "../utils/markdown.css";
import base from "./base.css";
import scrollbar from "./scrollbar.css";
import variables from "./variables.css";

export const ALL_PANEL_STYLES = [
  variables,
  base,
  scrollbar,
  panel,
  header,
  chatInput,
  unifiedInput,
  contextTag,
  taskButton,
  workflow,
  homeView,
  chatView,
  resumePrompt,
  questionChip,
  loading,
  progress,
  confirmCard,
  markdown,
].join("\n");
