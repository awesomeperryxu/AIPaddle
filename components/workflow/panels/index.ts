export { NodeConfigPanel } from "./node-config-panel"
export type { NodeConfigPanelProps } from "./node-config-panel"

// Re-export common components (no naming conflicts)
export * from "./common"

// Config panel wrapper components
export * from "./config-panel-wrapper"

// V2 config panels (380px right drawer design)
export * from "./configs/v2"

// Note: original configs are imported directly by node-config-panel, not re-exported to avoid name conflicts with types
