/**
 * @fileOverview Configuration and utilities for Workspace Icon Presets.
 */

export const WORKSPACE_ICON_PRESETS = [
  { id: "preset_1", label: "Preset 1", src: "/workspace-icons/preset-1.png" },
  { id: "preset_2", label: "Preset 2", src: "/workspace-icons/preset-2.png" },
  { id: "preset_3", label: "Preset 3", src: "/workspace-icons/preset-3.png" },
  { id: "preset_4", label: "Preset 4", src: "/workspace-icons/preset-4.png" },
  { id: "preset_5", label: "Preset 5", src: "/workspace-icons/preset-5.png" },
];

/**
 * Resolves the image source for a workspace icon preset.
 * Fallbacks to preset_1 if no preset is provided.
 */
export function getWorkspaceIconSrc(iconPreset?: string | null): string {
  if (!iconPreset) return WORKSPACE_ICON_PRESETS[0].src;
  
  const preset = WORKSPACE_ICON_PRESETS.find(p => p.id === iconPreset);
  return preset ? preset.src : WORKSPACE_ICON_PRESETS[0].src;
}
