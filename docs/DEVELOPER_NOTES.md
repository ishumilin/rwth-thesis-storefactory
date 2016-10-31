# Developer Notes: StoreFactory Digital Twin

This document outlines technical details regarding the 3D rendering pipeline, custom patches applied to the legacy BabylonJS loader, and known limitations of the visualization system.

## 1. Torso Rendering Fixes

### Root Cause
The high-fidelity Torso mesh used in this project contains **>65,000 vertices**. When converted to glTF 1.0 using `obj2gltf`, this results in indices being stored as `UNSIGNED_INT` (GL constant `5125`).

The legacy BabylonJS v2.2 glTF loader included in this project did not originally map `UNSIGNED_INT` in its component-type enum. Consequently, indices were interpreted as `Float32Array` instead of `Uint32Array`, leading to corrupted geometry (invalid indices, NaNs) and a failure to render the model.

### Applied Patches
The file `StoreFactory.Web/wwwroot/lib/babylon/babylon.glTFFileLoader.js` has been patched to support these large meshes and legacy material definitions.

#### A. UNSIGNED_INT Support
Added mapping for `5125` to the `EComponentType` enum and handled it in `getBufferFromAccessor`.

```javascript
// Added to EComponentType enum
EComponentType[EComponentType["UNSIGNED_INT"] = 5125] = "UNSIGNED_INT";

// Added to getBufferFromAccessor switch
case EComponentType.UNSIGNED_INT: return new Uint32Array(arrayBuffer, byteOffset, count);
```

#### B. Legacy Material Compatibility
Some exporters (e.g., `obj2gltf`) emit glTF 1.0 materials using `technique` + `values` properties directly, whereas the BabylonJS loader expects them nested under `instanceTechnique`. A fallback was added to `onShadersLoaded`:

```javascript
if (!material.instanceTechnique && material.technique) {
    material.instanceTechnique = { technique: material.technique, values: material.values };
}
```

## 2. Reproduction Steps (Assets)

To reproduce the glTF assets from source OBJs:

1.  **Tooling**: Use `obj2gltf` (Node.js tool).
2.  **Command**:
    ```bash
    node obj2gltf/bin/obj2gltf.js -i /path/to/Torso.obj -o /path/to/Torso.gltf -s
    ```
    *The `-s` flag is crucial for separate binary (.bin) output.*
3.  **Placement**: Generated files (`.gltf`, `.bin`, `.glsl`) must be placed in `StoreFactory.Web/wwwroot/models/`.

## 3. Visualization Simplifications & Limitations

The 3D view in the simulator serves as a **visual indicator** of shrinkage factors, not a physically-based cloth simulation.

### A. Axis Scaling vs. Deformation
Shrinkage is applied via basic **scaling transforms** (BabylonJS `scaling` property) along X/Y/Z axes. This does not account for:
*   Cloth drape or wrinkles.
*   Gravity or material stiffness.
*   Collision-driven deformation against the mannequin.

### B. Sleeve Heuristic
The `tshirt.gltf` model is a single mesh. To shrink sleeves independently of the body length:
*   The system splits triangles based on a simple **X-position threshold**.
*   Triangles beyond the threshold are treated as "sleeves".
*   This can cause minor visual discontinuities at the seam line near the armpit.

### C. Mannequin Alignment
The shirt overlay is aligned to the mannequin using "best-effort" manual offsets (`manualDefaults` in `mannequin-viewer.js`). It does not use a shared skeletal rig or landmarks.

### D. Simplified Torso
The mannequin torso is rendered as a decimated wireframe to ensure performance and visual clarity of the overlay. It is not a topological match for the shirt mesh.