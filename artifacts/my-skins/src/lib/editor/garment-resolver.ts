import { GARMENT_REGISTRY } from "./garment-registry.ts";
import { validateGarmentManifest, type GarmentCategory, type GarmentManifest } from "./garment-manifest.ts";

type Pick = { category: GarmentCategory; variant?: string; requested?: string };
const has = (text: string, pattern: RegExp) => pattern.test(text);
export function resolveGarmentManifest(prompt: string, id = crypto.randomUUID()): GarmentManifest {
  const p = prompt.toLowerCase(); let top: Pick | undefined; let bottom: Pick | undefined; let onePiece: Pick | undefined; let footwear: Pick | undefined; const fallback: GarmentManifest["fallback"] = [];
  if (has(p,/princess|dress|kjole|prinsesse/)) { onePiece={category:"dress",variant:has(p,/school|anime|skole/)?"school":"princess"}; footwear={category:"sneakers",variant:"low-top"}; }
  else if (has(p,/football|soccer/)) { top={category:"football-jersey",variant:"numbered"}; bottom={category:"shorts",variant:"football"}; footwear={category:"football-boots",variant:"studded"}; }
  else if (has(p,/knight|armo[u]?r/)) { top={category:"jacket",variant:"armoured",requested:"armour-top"}; bottom={category:"trousers",variant:"armoured",requested:"armour-legs"}; footwear={category:"boots",variant:"fantasy"}; }
  else {
    if (has(p,/zip\s*(hoodie|jacket)/)) top={category:has(p,/hoodie/)?"zip-hoodie":"jacket",variant:"zip"};
    else if (has(p,/hoodie|hettegenser/)) top={category:"hoodie"}; else if (has(p,/t[- ]?shirt|\btee\b|\bshirt\b|t-skjorte/)) top={category:"tshirt"};
    else if (has(p,/sweatshirt|pyjama|pajama/)) top={category:"sweatshirt"}; else if (has(p,/coat|suit|blazer/)) top={category:"jacket",variant:has(p,/winter|coat/)?"winter":"formal",requested:has(p,/coat/)?"coat":has(p,/blazer/)?"blazer":"suit"};
    else if (has(p,/ninja|tunic/)) top={category:"jacket",variant:"zip",requested:"tunic"}; else top={category:"tshirt"};
    if (has(p,/cargo/)) bottom={category:"cargo-pants"}; else if (has(p,/jeans|denim/)) bottom={category:"jeans"}; else if (has(p,/jogger/)) bottom={category:"joggers"}; else if (has(p,/shorts/)) bottom={category:"shorts"}; else bottom={category:"trousers",variant:has(p,/pyjama|pajama/)?"pyjama":"straight"};
    footwear={category:has(p,/winter|ninja|knight/)?"boots":"sneakers"};
  }
  const item=(pick:Pick) => { const def=GARMENT_REGISTRY[pick.category]; if(pick.requested) fallback.push({requestedGarment:pick.requested,resolvedGarment:pick.category,fallbackUsed:true}); return {category:pick.category,variant:pick.variant??def.variants[0],fit:def.defaultFit,length:def.slot==="bottom"?"full" as const:"regular" as const,material:def.materials[0],constructionModules:[...def.requiredModules]}; };
  const preview=[top?.category,bottom?.category,onePiece?.category,footwear?.category].filter(Boolean) as string[];
  return validateGarmentManifest({version:1,outfitId:id,style:has(p,/football/)?"sport":has(p,/princess/)?"fantasy":has(p,/formal|suit/)?"formal":"casual",top:top?item(top):undefined,bottom:bottom?item(bottom):undefined,onePiece:onePiece?item(onePiece):undefined,footwear:footwear?{category:footwear.category,variant:footwear.variant??GARMENT_REGISTRY[footwear.category].variants[0]}:undefined,accessories:[],fallback,metadata:{exportType:"roblox-classic",previewRepresentation:"geometry-assisted",hasReal3DExport:false,previewGarments:preview,exportedItems:["shirt","pants"]}});
}
