import fs from "node:fs";
import { toFile } from "openai";
import { Buffer } from "node:buffer";
import { assertOpenAiConfigured, openai } from "../client";
export { openai } from "../client";

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  assertOpenAiConfigured();
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  assertOpenAiConfigured();
  const images = await Promise.all(
    imageFiles.map((file) =>
      toFile(fs.createReadStream(file), file, {
        type: "image/png",
      })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}

/** Edit in-memory PNG references with gpt-image-1 at final-art quality. */
export async function editImageBuffers(
  inputs: Array<{ data: Buffer; filename: string }>,
  prompt: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  assertOpenAiConfigured();
  const images = await Promise.all(inputs.map(({ data, filename }) =>
    toFile(data, filename, { type: "image/png" })
  ));
  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
    size: "1536x1024",
    quality: "high",
    output_format: "png",
  }, { signal });
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw Object.assign(new Error("Malformed image response"), { code: "AI_IMAGE_RESPONSE" });
  return Buffer.from(encoded, "base64");
}
