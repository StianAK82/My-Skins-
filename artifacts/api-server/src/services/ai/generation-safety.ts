import { generationSafetyReportSchema } from "../../lib/generated-outfit-contracts.ts";

const blocked = /(?:nude|naked|porn|sex(?:ual)?|nazi|swastika|self[- ]?harm|suicide|cocaine|heroin|kill\s+(?:all|the)|address\s+is|phone\s+number)/i;
const protectedIp = /(?:nike|adidas|disney|marvel|pokemon|real madrid|barcelona)/i;
export function assessGenerationSafety(prompt:string) {
  if (blocked.test(prompt)) return generationSafetyReportSchema.parse({decision:"block",childFriendly:false,userMessage:"Let's make a fun, friendly outfit instead.",protectedIp:false});
  if (protectedIp.test(prompt)) return generationSafetyReportSchema.parse({decision:"transform",childFriendly:true,userMessage:"I can make an original design with a similar general theme, without the logo.",protectedIp:true});
  return generationSafetyReportSchema.parse({decision:"allow",childFriendly:true,userMessage:"",protectedIp:false});
}
