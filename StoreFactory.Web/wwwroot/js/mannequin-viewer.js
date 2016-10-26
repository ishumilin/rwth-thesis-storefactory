// 3D Mannequin viewer (BabylonJS + glTF 1.0 loader)
var mannequinViewer = (function () {
    var canvas;
    var engine;
    var scene;
    var camera;
    var light;
    var modelRoot;
    var mannequinRoot;
    var tshirtRoot;
    var isInitialized = false;
    var torsoMaterial;
    var tshirtMaterial;
    var torsoWireMaterial;
    var torsoDecimatedMesh;
    var torsoMeshes = [];
    var tshirtMeshes = [];
    var tshirtBodyMesh = null;
    var tshirtSleeveMesh = null;
    var torsoBaseScales = new Map();
    var tshirtBaseScales = new Map();
    var debugPanel;
    var debugControls = {};
    var debugInitialized = false;
    var debugCameraTarget = null;
    var lastShrinkage = { lengthFactor: 1, widthFactor: 1, sleeveFactor: 1 };
    var manualDefaults = {
        torsoPosition: new BABYLON.Vector3(1.42, -7.88, -2.71),
        torsoScale: new BABYLON.Vector3(1.0, 1.0, 1.0),
        torsoRotation: new BABYLON.Vector3(0, 0, Math.PI),
        tshirtPosition: new BABYLON.Vector3(-7.84, 8.83, -4.19),
        tshirtScale: new BABYLON.Vector3(3.55, 3.55, 3.55),
        // Keep shirt orientation consistent with torso.
        // The imported glTF is in a different handedness/orientation; without this,
        // the split meshes can appear flipped vertically.
        tshirtRotation: new BABYLON.Vector3(0, 0, Math.PI),
        cameraAlpha: 5.1,
        cameraBeta: 1.26,
        cameraRadius: 20.5,
        cameraTarget: new BABYLON.Vector3(0, 11.28, 0)
    };

    // Pivot helpers (implemented via parent meshes so we can scale around a chosen center)
    var tshirtBodyPivot = null;
    var tshirtSleevePivot = null;

    function applyShrinkageScaling() {
        var width = lastShrinkage.widthFactor || 1;
        var length = lastShrinkage.lengthFactor || 1;
        var sleeve = lastShrinkage.sleeveFactor || 1;

        if (mannequinRoot) {
            mannequinRoot.scaling = manualDefaults.torsoScale.clone();
        }
        if (tshirtRoot) {
            tshirtRoot.scaling = manualDefaults.tshirtScale.clone();
        }

        torsoMeshes.forEach(function (mesh) {
            if (!mesh) {
                return;
            }
            var baseScale = torsoBaseScales.get(mesh) || new BABYLON.Vector3(1, 1, 1);
            mesh.scaling = baseScale.clone();
        });
        if (torsoDecimatedMesh) {
            var decScale = torsoBaseScales.get(torsoDecimatedMesh) || new BABYLON.Vector3(1, 1, 1);
            torsoDecimatedMesh.scaling = decScale.clone();
        }
        if (tshirtBodyMesh) {
            // Scale around the body pivot (center of the body subset)
            if (tshirtBodyPivot) {
                tshirtBodyPivot.scaling = new BABYLON.Vector3(width, length, width);
            } else {
                tshirtBodyMesh.scaling = new BABYLON.Vector3(width, length, width);
            }
        }
        if (tshirtSleeveMesh) {
            // Scale around the sleeve pivot (center of the sleeves subset)
            if (tshirtSleevePivot) {
                tshirtSleevePivot.scaling = new BABYLON.Vector3(sleeve, length, width);
            } else {
                tshirtSleeveMesh.scaling = new BABYLON.Vector3(sleeve, length, width);
            }
        }
        if (tshirtRoot) {
            tshirtRoot.position = manualDefaults.tshirtPosition.clone();
        }
    }

    function applyManualDefaults() {
        if (mannequinRoot) {
            mannequinRoot.position = manualDefaults.torsoPosition.clone();
            mannequinRoot.scaling = manualDefaults.torsoScale.clone();
            mannequinRoot.rotation = manualDefaults.torsoRotation.clone();
        }
        if (tshirtRoot) {
            tshirtRoot.position = manualDefaults.tshirtPosition.clone();
            tshirtRoot.scaling = manualDefaults.tshirtScale.clone();
            tshirtRoot.rotation = manualDefaults.tshirtRotation.clone();
        }
        if (camera) {
            camera.alpha = manualDefaults.cameraAlpha;
            camera.beta = manualDefaults.cameraBeta;
            camera.radius = manualDefaults.cameraRadius;
            camera.setTarget(manualDefaults.cameraTarget.clone());
        }
        applyShrinkageScaling();
    }

    function computeBounds(meshes) {
        var min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        var max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        meshes.forEach(function (m) {
            if (!m || !m.getBoundingInfo || m.getTotalVertices && m.getTotalVertices() === 0) {
                return;
            }
            var bi = m.getBoundingInfo();
            if (!bi) {
                return;
            }
            var bb = bi.boundingBox;
            min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
            max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
        });

        if (!isFinite(min.x) || !isFinite(max.x)) {
            return null;
        }

        return { min: min, max: max };
    }

    function centerModel(meshes) {
        if (!modelRoot) {
            return;
        }
        modelRoot.position = BABYLON.Vector3.Zero();
        modelRoot.computeWorldMatrix(true);
        var bounds = computeBounds(meshes);
        if (!bounds) {
            return;
        }
        var center = bounds.min.add(bounds.max).scale(0.5);
        modelRoot.position = modelRoot.position.subtract(center);
        meshes.forEach(function (mesh) {
            if (mesh && mesh._updateBoundingInfo) {
                mesh._updateBoundingInfo();
            }
            if (mesh && mesh.computeWorldMatrix) {
                mesh.computeWorldMatrix(true);
            }
        });
        return bounds;
    }

    function normalizeRootToCenter(root, meshes, label) {
        if (!root) {
            return null;
        }
        root.position = BABYLON.Vector3.Zero();
        root.scaling = new BABYLON.Vector3(1, 1, 1);
        root.computeWorldMatrix(true);
        var bounds = computeBounds(meshes);
        if (!bounds) {
            return null;
        }
        var center = bounds.min.add(bounds.max).scale(0.5);
        root.position = root.position.subtract(center);
        meshes.forEach(function (mesh) {
            if (mesh && mesh._updateBoundingInfo) {
                mesh._updateBoundingInfo();
            }
            if (mesh && mesh.computeWorldMatrix) {
                mesh.computeWorldMatrix(true);
            }
        });
        var centeredBounds = computeBounds(meshes);
        return centeredBounds || bounds;
    }

    function splitTshirtMesh(mesh) {
        if (!mesh || !mesh.getVerticesData || !mesh.getIndices) {
            return null;
        }
        var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        var normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        var uvs = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
        var indices = mesh.getIndices();
        if (!positions || !indices || positions.length < 3) {
            return null;
        }

        var minX = Infinity;
        var maxX = -Infinity;
        for (var i = 0; i < positions.length; i += 3) {
            var x = positions[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }
        var centerX = (minX + maxX) / 2;
        var halfWidth = (maxX - minX) / 2;
        var sleeveThreshold = halfWidth * 0.6;

        var sleeveVertex = new Array(positions.length / 3);
        for (var v = 0; v < sleeveVertex.length; v++) {
            var vx = positions[v * 3];
            sleeveVertex[v] = Math.abs(vx - centerX) > sleeveThreshold;
        }

        var sleeveIndices = [];
        var bodyIndices = [];
        for (var idx = 0; idx < indices.length; idx += 3) {
            var i0 = indices[idx];
            var i1 = indices[idx + 1];
            var i2 = indices[idx + 2];
            var isSleeve = sleeveVertex[i0] && sleeveVertex[i1] && sleeveVertex[i2];
            if (isSleeve) {
                sleeveIndices.push(i0, i1, i2);
            } else {
                bodyIndices.push(i0, i1, i2);
            }
        }

        function computeSubsetCenter(indicesSubset) {
            var min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
            var max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
            for (var p = 0; p < indicesSubset.length; p++) {
                var idx = indicesSubset[p] * 3;
                min.x = Math.min(min.x, positions[idx]);
                min.y = Math.min(min.y, positions[idx + 1]);
                min.z = Math.min(min.z, positions[idx + 2]);
                max.x = Math.max(max.x, positions[idx]);
                max.y = Math.max(max.y, positions[idx + 1]);
                max.z = Math.max(max.z, positions[idx + 2]);
            }
            return min.add(max).scale(0.5);
        }

        function buildMesh(name, indicesSubset) {
            if (!indicesSubset.length) {
                return null;
            }
            // IMPORTANT:
            // Keep the same vertex coordinates as the original imported mesh.
            // We only split the index buffer, so sleeves/body stay perfectly aligned.
            var newMesh = new BABYLON.Mesh(name, scene);
            var data = new BABYLON.VertexData();
            data.positions = positions.slice();
            data.indices = indicesSubset;
            if (normals) {
                data.normals = normals.slice();
            }
            if (uvs) {
                data.uvs = uvs.slice();
            }
            data.applyToMesh(newMesh, true);
            newMesh.material = mesh.material;
            newMesh.renderingGroupId = mesh.renderingGroupId;
            newMesh.isPickable = false;
            return { mesh: newMesh, center: computeSubsetCenter(indicesSubset) };
        }

        return {
            body: buildMesh(mesh.name + '_body', bodyIndices),
            sleeves: buildMesh(mesh.name + '_sleeves', sleeveIndices)
        };
    }

    function createDecimatedMesh(sourceMesh, step) {
        if (!sourceMesh || !sourceMesh.getVerticesData || !sourceMesh.getIndices) {
            return null;
        }
        var positions = sourceMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        var indices = sourceMesh.getIndices();
        if (!positions || !indices || indices.length < 3) {
            return null;
        }
        var decPositions = [];
        var decIndices = [];
        var stride = Math.max(1, step || 8);
        var indexTriplets = Math.floor(indices.length / 3);
        for (var i = 0; i < indexTriplets; i += stride) {
            var base = i * 3;
            var i0 = indices[base] * 3;
            var i1 = indices[base + 1] * 3;
            var i2 = indices[base + 2] * 3;
            if (i2 + 2 >= positions.length) {
                continue;
            }
            var v0 = decPositions.length / 3;
            decPositions.push(positions[i0], positions[i0 + 1], positions[i0 + 2]);
            decPositions.push(positions[i1], positions[i1 + 1], positions[i1 + 2]);
            decPositions.push(positions[i2], positions[i2 + 1], positions[i2 + 2]);
            decIndices.push(v0, v0 + 1, v0 + 2);
        }
        if (!decPositions.length) {
            return null;
        }
        var decNormals = [];
        BABYLON.VertexData.ComputeNormals(decPositions, decIndices, decNormals);
        var decData = new BABYLON.VertexData();
        decData.positions = decPositions;
        decData.indices = decIndices;
        decData.normals = decNormals;
        if (torsoDecimatedMesh) {
            torsoDecimatedMesh.dispose();
        }
        torsoDecimatedMesh = new BABYLON.Mesh(sourceMesh.name + '_decimated', scene);
        decData.applyToMesh(torsoDecimatedMesh, true);
        torsoDecimatedMesh.material = torsoWireMaterial;
        torsoDecimatedMesh.isPickable = false;
        torsoDecimatedMesh.renderingGroupId = 1;
        if (sourceMesh.parent) {
            torsoDecimatedMesh.parent = sourceMesh.parent;
        }
        torsoDecimatedMesh.computeWorldMatrix(true);
        return torsoDecimatedMesh;
    }

    function getBoundsExtent(bounds) {
        if (!bounds) {
            return null;
        }
        return bounds.max.subtract(bounds.min);
    }

    function getBoundsCenter(meshes) {
        var bounds = computeBounds(meshes);
        if (!bounds) {
            return null;
        }
        return bounds.min.add(bounds.max).scale(0.5);
    }

    function frameCameraToMeshes(meshes) {
        try {
            if (!meshes || meshes.length === 0 || !camera) {
                return;
            }

            var bounds = computeBounds(meshes);
            if (!bounds) {
                return;
            }
            var center = bounds.min.add(bounds.max).scale(0.5);
            var extent = bounds.max.subtract(bounds.min);
            var radius = Math.max(extent.y, extent.x, extent.z) * 0.7;
            if (!isFinite(radius) || radius <= 0) {
                radius = 2;
            }

            camera.alpha = Math.PI / 2;
            camera.beta = Math.PI / 2.4;
            camera.setTarget(BABYLON.Vector3.Zero());
            camera.radius = Math.max(radius * 1.2, 3.5);
        } catch (e) {
            console.warn('[mannequin-viewer] frameCameraToMeshes failed', e);
        }
    }

    function updateRangeLabel(label, value, digits) {
        if (!label) {
            return;
        }
        var precision = typeof digits === 'number' ? digits : 2;
        label.textContent = value.toFixed(precision);
    }

    function bindRangeControl(id, labelId, onChange, digits) {
        var input = document.getElementById(id);
        if (!input) {
            return null;
        }
        var label = labelId ? document.getElementById(labelId) : null;
        var handler = function () {
            var value = parseFloat(input.value || 0);
            updateRangeLabel(label, value, digits);
            if (onChange) {
                onChange(value);
            }
            updateDebugOutput();
        };
        input.addEventListener('input', handler);
        return { input: input, label: label, handler: handler };
    }

    function getCameraTarget() {
        if (!camera) {
            return new BABYLON.Vector3(0, 0, 0);
        }
        if (camera.getTarget) {
            return camera.getTarget();
        }
        return camera.target || new BABYLON.Vector3(0, 0, 0);
    }

    function ensureDebugPanel() {
        if (debugInitialized) {
            return;
        }
        debugPanel = document.getElementById('mannequinDebugPanel');
        if (!debugPanel) {
            return;
        }
        debugControls.torsoX = bindRangeControl('dbgTorsoX', 'dbgTorsoXVal', function (value) {
            if (mannequinRoot) {
                mannequinRoot.position.x = value;
            }
        });
        debugControls.torsoY = bindRangeControl('dbgTorsoY', 'dbgTorsoYVal', function (value) {
            if (mannequinRoot) {
                mannequinRoot.position.y = value;
            }
        });
        debugControls.torsoZ = bindRangeControl('dbgTorsoZ', 'dbgTorsoZVal', function (value) {
            if (mannequinRoot) {
                mannequinRoot.position.z = value;
            }
        });
        debugControls.torsoScale = bindRangeControl('dbgTorsoScale', 'dbgTorsoScaleVal', function (value) {
            if (mannequinRoot) {
                mannequinRoot.scaling = new BABYLON.Vector3(value, value, value);
            }
        });

        debugControls.shirtX = bindRangeControl('dbgShirtX', 'dbgShirtXVal', function (value) {
            if (tshirtRoot) {
                tshirtRoot.position.x = value;
            }
        });
        debugControls.shirtY = bindRangeControl('dbgShirtY', 'dbgShirtYVal', function (value) {
            if (tshirtRoot) {
                tshirtRoot.position.y = value;
            }
        });
        debugControls.shirtZ = bindRangeControl('dbgShirtZ', 'dbgShirtZVal', function (value) {
            if (tshirtRoot) {
                tshirtRoot.position.z = value;
            }
        });
        debugControls.shirtScale = bindRangeControl('dbgShirtScale', 'dbgShirtScaleVal', function (value) {
            if (tshirtRoot) {
                tshirtRoot.scaling = new BABYLON.Vector3(value, value, value);
            }
        });

        debugControls.camAlpha = bindRangeControl('dbgCamAlpha', 'dbgCamAlphaVal', function (value) {
            if (camera) {
                camera.alpha = value;
            }
        }, 2);
        debugControls.camBeta = bindRangeControl('dbgCamBeta', 'dbgCamBetaVal', function (value) {
            if (camera) {
                camera.beta = value;
            }
        }, 2);
        debugControls.camRadius = bindRangeControl('dbgCamRadius', 'dbgCamRadiusVal', function (value) {
            if (camera) {
                camera.radius = value;
            }
        }, 1);
        debugControls.camTargetX = bindRangeControl('dbgCamTargetX', 'dbgCamTargetXVal', function (value) {
            if (camera) {
                var target = debugCameraTarget || getCameraTarget();
                debugCameraTarget = new BABYLON.Vector3(value, target.y, target.z);
                camera.setTarget(debugCameraTarget);
            }
        });
        debugControls.camTargetY = bindRangeControl('dbgCamTargetY', 'dbgCamTargetYVal', function (value) {
            if (camera) {
                var target = debugCameraTarget || getCameraTarget();
                debugCameraTarget = new BABYLON.Vector3(target.x, value, target.z);
                camera.setTarget(debugCameraTarget);
            }
        });
        debugControls.camTargetZ = bindRangeControl('dbgCamTargetZ', 'dbgCamTargetZVal', function (value) {
            if (camera) {
                var target = debugCameraTarget || getCameraTarget();
                debugCameraTarget = new BABYLON.Vector3(target.x, target.y, value);
                camera.setTarget(debugCameraTarget);
            }
        });

        debugControls.output = document.getElementById('dbgOutput');
        debugInitialized = true;
    }

    function syncDebugControls() {
        if (!debugInitialized) {
            return;
        }
        if (mannequinRoot) {
            if (debugControls.torsoX) {
                debugControls.torsoX.input.value = mannequinRoot.position.x;
                updateRangeLabel(debugControls.torsoX.label, mannequinRoot.position.x);
            }
            if (debugControls.torsoY) {
                debugControls.torsoY.input.value = mannequinRoot.position.y;
                updateRangeLabel(debugControls.torsoY.label, mannequinRoot.position.y);
            }
            if (debugControls.torsoZ) {
                debugControls.torsoZ.input.value = mannequinRoot.position.z;
                updateRangeLabel(debugControls.torsoZ.label, mannequinRoot.position.z);
            }
            if (debugControls.torsoScale) {
                debugControls.torsoScale.input.value = mannequinRoot.scaling.x;
                updateRangeLabel(debugControls.torsoScale.label, mannequinRoot.scaling.x);
            }
        }
        if (tshirtRoot) {
            if (debugControls.shirtX) {
                debugControls.shirtX.input.value = tshirtRoot.position.x;
                updateRangeLabel(debugControls.shirtX.label, tshirtRoot.position.x);
            }
            if (debugControls.shirtY) {
                debugControls.shirtY.input.value = tshirtRoot.position.y;
                updateRangeLabel(debugControls.shirtY.label, tshirtRoot.position.y);
            }
            if (debugControls.shirtZ) {
                debugControls.shirtZ.input.value = tshirtRoot.position.z;
                updateRangeLabel(debugControls.shirtZ.label, tshirtRoot.position.z);
            }
            if (debugControls.shirtScale) {
                debugControls.shirtScale.input.value = tshirtRoot.scaling.x;
                updateRangeLabel(debugControls.shirtScale.label, tshirtRoot.scaling.x);
            }
        }
        if (camera) {
            if (debugControls.camAlpha) {
                debugControls.camAlpha.input.value = camera.alpha;
                updateRangeLabel(debugControls.camAlpha.label, camera.alpha);
            }
            if (debugControls.camBeta) {
                debugControls.camBeta.input.value = camera.beta;
                updateRangeLabel(debugControls.camBeta.label, camera.beta);
            }
            if (debugControls.camRadius) {
                debugControls.camRadius.input.value = camera.radius;
                updateRangeLabel(debugControls.camRadius.label, camera.radius, 1);
            }
            var target = getCameraTarget();
            debugCameraTarget = target.clone ? target.clone() : new BABYLON.Vector3(target.x, target.y, target.z);
            if (debugControls.camTargetX) {
                debugControls.camTargetX.input.value = target.x;
                updateRangeLabel(debugControls.camTargetX.label, target.x);
            }
            if (debugControls.camTargetY) {
                debugControls.camTargetY.input.value = target.y;
                updateRangeLabel(debugControls.camTargetY.label, target.y);
            }
            if (debugControls.camTargetZ) {
                debugControls.camTargetZ.input.value = target.z;
                updateRangeLabel(debugControls.camTargetZ.label, target.z);
            }
        }
        updateDebugOutput();
    }

    function updateDebugOutput() {
        if (!debugInitialized || !debugControls.output) {
            return;
        }
        var torsoPos = mannequinRoot ? mannequinRoot.position : new BABYLON.Vector3(0, 0, 0);
        var torsoScale = mannequinRoot ? mannequinRoot.scaling : new BABYLON.Vector3(1, 1, 1);
        var shirtPos = tshirtRoot ? tshirtRoot.position : new BABYLON.Vector3(0, 0, 0);
        var shirtScale = tshirtRoot ? tshirtRoot.scaling : new BABYLON.Vector3(1, 1, 1);
        var camTarget = getCameraTarget();
        var output = [
            'torsoOffset: { x: ' + torsoPos.x.toFixed(3) + ', y: ' + torsoPos.y.toFixed(3) + ', z: ' + torsoPos.z.toFixed(3) + ' }',
            'torsoScale: ' + torsoScale.x.toFixed(3),
            'tshirtOffset: { x: ' + shirtPos.x.toFixed(3) + ', y: ' + shirtPos.y.toFixed(3) + ', z: ' + shirtPos.z.toFixed(3) + ' }',
            'tshirtScale: ' + shirtScale.x.toFixed(3),
            'camera: { alpha: ' + (camera ? camera.alpha.toFixed(3) : '0') + ', beta: ' + (camera ? camera.beta.toFixed(3) : '0') + ', radius: ' + (camera ? camera.radius.toFixed(3) : '0') + ' }',
            'cameraTarget: { x: ' + camTarget.x.toFixed(3) + ', y: ' + camTarget.y.toFixed(3) + ', z: ' + camTarget.z.toFixed(3) + ' }'
        ].join('\n');
        debugControls.output.value = output;
    }

    function init() {
        canvas = document.getElementById('mannequinCanvas');
        if (!canvas || typeof BABYLON === 'undefined') {
            return;
        }
        BABYLON.SceneLoader.ShowLoadingScreen = false;
        engine = new BABYLON.Engine(canvas, true);
        engine.enableOfflineSupport = false;
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);

        camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 2, Math.PI / 2.4, 4, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 0.5;
        camera.upperRadiusLimit = 100;
        camera.minZ = 0.01;
        camera.maxZ = 10000;
        scene.skipPointerMovePicking = true;
        scene.skipPointerDownPicking = true;
        scene.collisionsEnabled = false;

        light = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.9;

        engine.runRenderLoop(function () {
            if (scene) {
                scene.render();
            }
        });

        window.addEventListener('resize', function () {
            if (engine) {
                engine.resize();
            }
        });

        loadModels();
        isInitialized = true;
    }


    function loadModels() {
        var modelsRoot = canvas.getAttribute('data-models-root') || '/models/';

        // Note: we load models via SceneLoader.Append and then collect the meshes that were added.
        function appendAndCollect(modelFile, onDone) {
            var before = scene.meshes.slice(0);
            BABYLON.SceneLoader.Append(modelsRoot, modelFile, scene, function () {
                scene.executeWhenReady(function () {
                    var after = scene.meshes;
                    var added = after.filter(function (m) { return before.indexOf(m) === -1; });
                    onDone(added);
                });
            });
        }

        modelRoot = new BABYLON.Mesh('modelRoot', scene);
        torsoMaterial = new BABYLON.StandardMaterial('torsoMat', scene);
        torsoMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
        torsoMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        torsoMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.8, 0.2);
        torsoMaterial.backFaceCulling = false;
        torsoMaterial.wireframe = false;
        torsoMaterial.alpha = 0.35;
        torsoMaterial.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        torsoMaterial.disableLighting = false;

        torsoWireMaterial = torsoMaterial.clone('torsoWireMat');
        torsoWireMaterial.wireframe = true;
        torsoWireMaterial.alpha = 1;
        torsoWireMaterial.disableLighting = true;

        tshirtMaterial = new BABYLON.StandardMaterial('tshirtMat', scene);
        tshirtMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
        tshirtMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        tshirtMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
        tshirtMaterial.backFaceCulling = false;
        tshirtMaterial.alpha = 1;
        tshirtMaterial.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;

        function forceStandardMaterial(meshes) {
            meshes.forEach(function (mesh) {
                if (!mesh) {
                    return;
                }
                if (mesh.material && mesh.material.dispose) {
                    mesh.material.dispose(true, true);
                }
                mesh.material = tshirtMaterial;
                mesh.isVisible = true;
                mesh.visibility = 1;
                mesh.alwaysSelectAsActiveMesh = true;
                mesh.isPickable = false;
                mesh.renderingGroupId = 2;
            });
        }

        function forceMaterialOnMeshes(meshes, material) {
            meshes.forEach(function (mesh) {
                if (!mesh) {
                    return;
                }
                if (mesh.material && mesh.material.dispose) {
                    mesh.material.dispose(true, true);
                }
                mesh.material = material;
                mesh.isVisible = true;
                mesh.visibility = 1;
                mesh.alwaysSelectAsActiveMesh = true;
                mesh.isPickable = false;
                mesh.renderingGroupId = 1;
            });
        }

        // Mannequin torso
        appendAndCollect('torso.gltf', function (addedMeshes) {
            torsoMeshes = addedMeshes.slice();
            torsoBaseScales = new Map();
            mannequinRoot = new BABYLON.Mesh('mannequinRoot', scene);
            mannequinRoot.parent = modelRoot;
            addedMeshes.forEach(function (mesh) { mesh.parent = mannequinRoot; });
            applyManualDefaults();
            forceMaterialOnMeshes(addedMeshes, torsoMaterial);
            addedMeshes.forEach(function (mesh) {
                if (!mesh) {
                    return;
                }
                if (mesh.setEnabled) {
                    mesh.setEnabled(true);
                }
                mesh.material = torsoWireMaterial;
                mesh.forceWireframe = true;
                mesh.renderingGroupId = 1;
                mesh.backFaceCulling = false;
                mesh.checkCollisions = false;
            });
            var decimationStride = 24;
            var decimated = createDecimatedMesh(addedMeshes[0], decimationStride);
            if (decimated) {
                torsoBaseScales.set(decimated, decimated.scaling.clone());
                addedMeshes.forEach(function (mesh) {
                    if (mesh && mesh.setEnabled) {
                        mesh.setEnabled(false);
                    }
                });
            }
            addedMeshes.forEach(function (mesh) {
                if (!mesh) {
                    return;
                }
                torsoBaseScales.set(mesh, mesh.scaling.clone());
            });
            var torsoBounds = normalizeRootToCenter(mannequinRoot, addedMeshes, 'torso');
            applyManualDefaults();

            // T-shirt overlay (load after torso finishes)
            appendAndCollect('tshirt.gltf', function (addedMeshes2) {
                tshirtMeshes = addedMeshes2.slice();
                tshirtBaseScales = new Map();
                tshirtRoot = new BABYLON.Mesh('tshirtRoot', scene);
                tshirtRoot.parent = modelRoot;
                addedMeshes2.forEach(function (mesh) { mesh.parent = tshirtRoot; });
                applyManualDefaults();
                forceStandardMaterial(addedMeshes2);
                var tshirtBounds = normalizeRootToCenter(tshirtRoot, addedMeshes2, 'tshirt');
                // Skip auto-scaling/auto-alignment to keep manual defaults stable on reload.
                applyManualDefaults();
                // Ensure torso/tshirt remain in same render group and force bounding info update.
                addedMeshes2.forEach(function (mesh) {
                    if (mesh && mesh._updateBoundingInfo) {
                        mesh._updateBoundingInfo();
                    }
                });
                addedMeshes2.forEach(function (mesh) {
                    if (!mesh) {
                        return;
                    }
                    tshirtBaseScales.set(mesh, mesh.scaling.clone());
                });
                if (tshirtMeshes.length) {
                    var split = splitTshirtMesh(tshirtMeshes[0]);
                    if (split) {
                        if (split.body && split.body.mesh) {
                            // Create a pivot parent at the part center so scaling stays centered.
                            tshirtBodyPivot = new BABYLON.Mesh('tshirtBodyPivot', scene);
                            tshirtBodyPivot.parent = tshirtRoot;
                            tshirtBodyPivot.position = split.body.center.clone();

                            split.body.mesh.parent = tshirtBodyPivot;
                            // Offset so the mesh stays at its original place relative to tshirtRoot.
                            split.body.mesh.position = split.body.center.scale(-1);
                            tshirtBodyMesh = split.body.mesh;
                        }
                        if (split.sleeves && split.sleeves.mesh) {
                            tshirtSleevePivot = new BABYLON.Mesh('tshirtSleevePivot', scene);
                            tshirtSleevePivot.parent = tshirtRoot;
                            tshirtSleevePivot.position = split.sleeves.center.clone();

                            split.sleeves.mesh.parent = tshirtSleevePivot;
                            split.sleeves.mesh.position = split.sleeves.center.scale(-1);
                            tshirtSleeveMesh = split.sleeves.mesh;
                        }
                        tshirtMeshes.forEach(function (mesh) {
                            if (mesh && mesh.setEnabled) {
                                mesh.setEnabled(false);
                            }
                        });
                        tshirtMeshes = [];
                    }
                }
                var allMeshes = addedMeshes.concat(addedMeshes2);
                modelRoot.position = BABYLON.Vector3.Zero();
                modelRoot.scaling = new BABYLON.Vector3(1, 1, 1);
                applyManualDefaults();
                ensureDebugPanel();
                if (debugPanel) {
                    debugPanel.style.display = 'block';
                }
                syncDebugControls();
            });
        });
    }

    function setVisible(isVisible) {
        var mannequinCanvas = document.getElementById('mannequinCanvas');
        if (!mannequinCanvas) {
            return;
        }
        mannequinCanvas.style.display = isVisible ? 'block' : 'none';
        if (debugPanel) {
            debugPanel.style.display = isVisible ? 'block' : 'none';
        }
        if (isVisible && !isInitialized) {
            init();
        } else if (isVisible) {
            ensureDebugPanel();
            syncDebugControls();
        }
        if (engine) {
            engine.resize();
        }
        if (isVisible) {
            applyManualDefaults();
            syncDebugControls();
        }
    }

    function updateShrinkage(shrinkage) {
        if (!shrinkage) {
            return;
        }
        lastShrinkage = {
            lengthFactor: typeof shrinkage.lengthFactor === 'number' ? shrinkage.lengthFactor : 1,
            widthFactor: typeof shrinkage.widthFactor === 'number' ? shrinkage.widthFactor : 1,
            sleeveFactor: typeof shrinkage.sleeveFactor === 'number' ? shrinkage.sleeveFactor : 1
        };
        applyShrinkageScaling();
        syncDebugControls();
    }

    return {
        init: init,
        setVisible: setVisible,
        updateShrinkage: updateShrinkage
    };
})();

$(document).ready(function () {
    var $sweater = $('#sweaterCanvas');
    var $mannequin = $('#mannequinCanvas');
    var $btn2d = $('#viewMode2d');
    var $btn3d = $('#viewMode3d');

    function activate(mode) {
        if (mode === '3d') {
            $sweater.hide();
            $mannequin.show();
            $btn3d.addClass('btn-primary').removeClass('btn-default');
            $btn2d.addClass('btn-default').removeClass('btn-primary');
            mannequinViewer.setVisible(true);
        } else {
            $mannequin.hide();
            $sweater.show();
            $btn2d.addClass('btn-primary').removeClass('btn-default');
            $btn3d.addClass('btn-default').removeClass('btn-primary');
            mannequinViewer.setVisible(false);
        }
    }

    $btn2d.on('click', function () { activate('2d'); });
    $btn3d.on('click', function () { activate('3d'); });

    activate('2d');
});