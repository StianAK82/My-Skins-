# System overview

The Express API owns safety, AI orchestration, canonical Classic compilation, storage and Roblox upload attempts. The React/Vite client owns the child-friendly editor and a primitive Three.js preview. `UniversalOutfitSpec` in `artifacts/api-server/src/lib/universal-outfit.ts` is the versioned target contract; the older `aiOutfitSchema` remains a migration input and is not yet removed. Primitive preview geometry is preview-only and is not Roblox layered clothing.
