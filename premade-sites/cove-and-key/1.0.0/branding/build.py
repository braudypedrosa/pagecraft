from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib.instancer import instantiateVariableFont
import json
root=Path(__file__).resolve().parent
font=TTFont(root.parents[3]/'brand/fonts/Manrope-VariableFont_wght.ttf');font=instantiateVariableFont(font,{'wght':600});gs=font.getGlyphSet();cmap=font.getBestCmap();scale=36/font['head'].unitsPerEm
paths=[];x=0
for char in 'Cove & Key':
 name=cmap[ord(char)];pen=SVGPathPen(gs);gs[name].draw(pen);paths.append(f'<path transform="translate({x},0)" d="{pen.getCommands()}"/>');x+=gs[name].width
mark='<path d="M49 21a23 23 0 1 0 0 28" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M12 39c11-14 19 13 32-1 6-6 10-7 18-7h15l8-9 8 8-8 9-7-7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
for name,color in [('light','#ffffff'),('dark','#123344'),('blue','#007da5'),('black','#000000')]:
 symbol=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 72" style="color:{color}">{mark}</svg>'
 (root/f'logos/svg/symbol-{name}.svg').write_text(symbol)
 logo=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {110+x*scale:.2f} 72" style="color:{color}">{mark}<g fill="{color}" transform="translate(110,49) scale({scale},-{scale})">'+''.join(paths)+'</g></svg>'
 (root/f'logos/svg/logo-{name}.svg').write_text(logo)
(root/'icons/favicon.svg').write_text((root/'logos/svg/symbol-blue.svg').read_text())
(root.parent/'assets').mkdir(exist_ok=True)
(root.parent/'assets/logo.svg').write_text((root/'logos/svg/logo-light.svg').read_text())
(root.parent/'assets/symbol.svg').write_text((root/'logos/svg/symbol-blue.svg').read_text())
colors={'ink':'#123344','brand':'#007da5','surface':'#eaf5f8','text':'#284d60','muted':'#526b78','line':'#bdcfd7','background':'#ffffff'}
(root/'colors/tokens.json').write_text(json.dumps(colors,indent=2))
(root/'colors/tokens.css').write_text(':root{'+''.join(f'--{k}:{v};' for k,v in colors.items())+'}')
(root/'typography/font-sources.md').write_text('Manrope variable font, SIL Open Font License. Bundled Pagecraft brand font used for outlined logo lettering. Website typography remains editable through native Pagecraft global controls.\n')
