export const STYLE_PRESETS = [
  { id: 'haikyuu', label: 'Volleyball anime' },
  { id: 'shojo', label: 'Soft shojo' },
  { id: 'chibi', label: 'Chibi' },
  { id: 'ink', label: 'Ink manga' },
  { id: 'action', label: 'Sports action' },
] as const

export const EXPRESSION_PRESETS = [
  { id: 'smile', label: 'Smile' },
  { id: 'determined', label: 'Determined' },
  { id: 'surprised', label: 'Surprised' },
  { id: 'shy', label: 'Shy' },
  { id: 'shout', label: 'Shout' },
  { id: 'calm', label: 'Calm' },
] as const

export const POSE_PRESETS = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'stand', label: 'Hands on hips' },
  { id: 'spike', label: 'Spike jump' },
  { id: 'receive', label: 'Ready receive' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'run', label: 'Running' },
] as const

export const FILTERS = [
  { id: 'original', label: 'As-is', help: 'Your picture, just as it is' },
  { id: 'ink', label: 'Ink', help: 'Black and white manga lines' },
  { id: 'screentone', label: 'Dots', help: 'Printed manga dots' },
  { id: 'contrast', label: 'Bold', help: 'Strong lights and darks' },
  { id: 'grey', label: 'Grey', help: 'Soft pencil grey' },
] as const

export const SFX_WORDS = ['WHOOSH', 'BA-DOOM', 'TAP', 'YEAH!', 'KRAK', 'SLAM'] as const

export const SFX_COLORS = ['#ff5a1f', '#1a1a1a', '#e11d48', '#2563eb', '#7c3aed', '#ca8a04'] as const

export type StyleId = (typeof STYLE_PRESETS)[number]['id']
export type ExpressionId = (typeof EXPRESSION_PRESETS)[number]['id']
export type PoseId = (typeof POSE_PRESETS)[number]['id']

export function presetLabel<T extends { id: string; label: string }>(
  presets: readonly T[],
  id: string,
): string {
  return presets.find((preset) => preset.id === id)?.label ?? id
}
