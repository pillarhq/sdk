/**
 * DevTools CSS Styles
 * Styles for the DOM Scanner preview panel
 */

export const DEVTOOLS_STYLES = `
/* Pillar DevTools Styles */
.pillar-devtools-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.pillar-devtools-panel {
  background: #1e1e2e;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  max-width: 800px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #e0e0e0;
}

.pillar-devtools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #2d2d3d;
  background: #252535;
}

.pillar-devtools-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.pillar-devtools-badge {
  padding: 3px 8px;
  background: #6366f1;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pillar-devtools-close {
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #9090a0;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.pillar-devtools-close:hover {
  background: #3d3d4d;
  color: #ffffff;
}

.pillar-devtools-stats {
  display: flex;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid #2d2d3d;
  background: #1a1a2a;
  flex-wrap: wrap;
}

.pillar-devtools-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.pillar-devtools-stat-value {
  font-weight: 600;
  color: #8b5cf6;
}

.pillar-devtools-stat-label {
  color: #9090a0;
}

.pillar-devtools-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.pillar-devtools-tree {
  font-family: 'SF Mono', Monaco, 'Inconsolata', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.pillar-devtools-node {
  margin-left: 16px;
  position: relative;
}

.pillar-devtools-node::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #3d3d4d;
}

.pillar-devtools-node-root {
  margin-left: 0;
}

.pillar-devtools-node-root::before {
  display: none;
}

.pillar-devtools-node-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.1s;
}

.pillar-devtools-node-header:hover {
  background: rgba(139, 92, 246, 0.1);
}

.pillar-devtools-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6d6d7d;
  flex-shrink: 0;
  margin-top: 2px;
}

.pillar-devtools-toggle svg {
  transition: transform 0.15s;
}

.pillar-devtools-toggle--expanded svg {
  transform: rotate(90deg);
}

.pillar-devtools-tag {
  color: #f472b6;
}

.pillar-devtools-attr-name {
  color: #a78bfa;
}

.pillar-devtools-attr-value {
  color: #34d399;
}

.pillar-devtools-interactable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #6366f1;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  color: #ffffff;
  margin-left: 6px;
}

.pillar-devtools-text {
  color: #94a3b8;
  font-style: italic;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pillar-devtools-children {
  display: none;
}

.pillar-devtools-children--expanded {
  display: block;
}

.pillar-devtools-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #2d2d3d;
  background: #252535;
}

.pillar-devtools-footer-info {
  font-size: 12px;
  color: #9090a0;
}

.pillar-devtools-actions {
  display: flex;
  gap: 10px;
}

.pillar-devtools-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  border: none;
}

.pillar-devtools-btn:active {
  transform: scale(0.98);
}

.pillar-devtools-btn--secondary {
  background: #3d3d4d;
  color: #e0e0e0;
}

.pillar-devtools-btn--secondary:hover {
  background: #4d4d5d;
}

.pillar-devtools-btn--primary {
  background: #6366f1;
  color: #ffffff;
}

.pillar-devtools-btn--primary:hover {
  background: #4f46e5;
}
`;
