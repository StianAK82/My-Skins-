export type HoodieConstruction={fit:"regular"|"oversized"|"cropped";torsoWidth:number;torsoLength:number;torsoDepth:number;shoulderDrop:number;sleeveLength:number;sleeveFullness:number;cuffHeight:number;waistbandHeight:number;hoodHeight:number;hoodDepth:number;hoodOpeningWidth:number;hoodOpeningHeight:number;pocketType:"kangaroo"|"two-front"|"none";pocketWidth:number;pocketHeight:number;drawstringEnabled:boolean;drawstringLength:number};
export type HoodieGarmentSpec={id:string;category:"hoodie";slot:"top";color:string;material:"cotton-fleece";construction:HoodieConstruction};
export type HoodieOutfitSpec={requestLanguage:"en";originalPrompt:string;normalisedPrompt:string;outfitName:string;overallStyle:string;palette:string[];top:HoodieGarmentSpec;bottom:null;footwear:{category:"none";previewOnly:true};graphics:unknown[];classicExportPlan:{shirt:true;pants:false;width:585;height:559;exportType:"roblox-classic";previewRepresentation:"procedural-hoodie";hasReal3DExport:false};safetyDecision:"allow";modelConfidence:number;generationSeed:string};
const regular: HoodieConstruction={fit:"regular",torsoWidth:1.12,torsoLength:1.1,torsoDepth:.68,shoulderDrop:.12,sleeveLength:1,sleeveFullness:1,cuffHeight:.16,waistbandHeight:.14,hoodHeight:.96,hoodDepth:.44,hoodOpeningWidth:.43,hoodOpeningHeight:.66,pocketType:"kangaroo",pocketWidth:.72,pocketHeight:.32,drawstringEnabled:true,drawstringLength:.38};
const variants={
 "white-hoodie-regular":regular,
 "white-hoodie-oversized":{...regular,fit:"oversized",torsoWidth:1.42,torsoDepth:.78,sleeveFullness:1.28,shoulderDrop:.22},
 "white-hoodie-cropped":{...regular,fit:"cropped",torsoLength:.72},
 "white-hoodie-large-hood":{...regular,hoodHeight:1.25,hoodDepth:.62,hoodOpeningWidth:.49,hoodOpeningHeight:.78},
 "white-hoodie-no-drawstrings":{...regular,drawstringEnabled:false},
 "white-hoodie-two-pockets":{...regular,pocketType:"two-front",pocketWidth:.3,pocketHeight:.3},
} satisfies Record<string,HoodieConstruction>;
export type HoodieFixtureName=keyof typeof variants;
export const HOODIE_FIXTURE_NAMES=Object.keys(variants) as HoodieFixtureName[];
export function getHoodieFixture(name:HoodieFixtureName):HoodieOutfitSpec {const construction=structuredClone(variants[name]);return {requestLanguage:"en",originalPrompt:name,normalisedPrompt:name.replaceAll("-"," "),outfitName:"White Hoodie",overallStyle:"minimal",palette:["#f4f4f2","#d5d8dc"],top:{id:"top",category:"hoodie",slot:"top",color:"#f4f4f2",material:"cotton-fleece",construction},bottom:null,footwear:{category:"none",previewOnly:true},graphics:[],classicExportPlan:{shirt:true,pants:false,width:585,height:559,exportType:"roblox-classic",previewRepresentation:"procedural-hoodie",hasReal3DExport:false},safetyDecision:"allow",modelConfidence:1,generationSeed:name}}
