/** The product UI font manifest. The portable builder embeds these files;
 * Cloud serves the same files locally. Never used by published site content. */
export const UI_FONT_FACES = [
  { family: 'Manrope', file: 'Manrope-VariableFont_wght.ttf', weight: '400 700' },
  { family: 'DM Sans', file: 'DMSans-Regular.ttf', weight: '400' },
  { family: 'DM Sans', file: 'DMSans-Medium.ttf', weight: '500' },
  { family: 'DM Sans', file: 'DMSans-SemiBold.ttf', weight: '600' },
];
export const UI_FONTS_CSS = UI_FONT_FACES.map(({ family, file, weight }) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("/brand/fonts/${file}") format("truetype")}`
).join('\n');
