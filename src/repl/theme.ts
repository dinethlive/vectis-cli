/** Purple/violet palette for Vectis CLI — truecolor ANSI (RGB) */
function rgb(r: number, g: number, b: number) {
  return (text: string): string => `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

export const vc = {
  deep:   rgb(109, 40,  217), // #6D28D9 — deep violet
  vivid:  rgb(124, 58,  237), // #7C3AED — vivid purple
  medium: rgb(139, 92,  246), // #8B5CF6 — medium purple
  bright: rgb(167, 139, 250), // #A78BFA — bright lavender
  light:  rgb(196, 181, 253), // #C4B5FD — light lavender
  pale:   rgb(221, 214, 254), // #DDD6FE — pale lavender
} as const;
