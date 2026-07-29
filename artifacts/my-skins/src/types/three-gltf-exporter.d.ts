// three ships GLTFExporter as an untyped example module; give it a minimal type
// so the dynamic import in AvatarPreview stays type-safe.
declare module "three/examples/jsm/exporters/GLTFExporter.js" {
  import type { Object3D } from "three";
  export class GLTFExporter {
    parseAsync(
      input: Object3D | Object3D[],
      options?: { binary?: boolean; onlyVisible?: boolean }
    ): Promise<ArrayBuffer | Record<string, unknown>>;
  }
}
