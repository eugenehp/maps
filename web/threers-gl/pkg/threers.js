/**
 * Alembic geometry caches.
 */
export class WebAlembicLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAlembicLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webalembicloader_free(ptr, 0);
    }
    /**
     * How many meshes the archive holds, for a caller that wants to choose.
     * @param {Uint8Array} bytes
     * @returns {any[]}
     */
    mesh_names(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webalembicloader_mesh_names(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v2 = getArrayJsValueFromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    constructor() {
        const ret = wasm.webalembicloader_new();
        this.__wbg_ptr = ret;
        WebAlembicLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The first `PolyMesh` in the archive, as a geometry.
     * @param {Uint8Array} bytes
     * @returns {WebGeometry}
     */
    parse(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webalembicloader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebGeometry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebAlembicLoader.prototype[Symbol.dispose] = WebAlembicLoader.prototype.free;

export class WebAnimationClip {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAnimationClipFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webanimationclip_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get duration() {
        const ret = wasm.webanimationclip_duration(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webanimationclip_name(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} name
     * @param {number} _duration
     */
    constructor(name, _duration) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webanimationclip_new(ptr0, len0, _duration);
        this.__wbg_ptr = ret;
        WebAnimationClipFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebAnimationClip.prototype[Symbol.dispose] = WebAnimationClip.prototype.free;

export class WebAnimationMixer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAnimationMixerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webanimationmixer_free(ptr, 0);
    }
    /**
     * @param {WebAnimationClip} clip
     * @returns {number}
     */
    clipAction(clip) {
        _assertClass(clip, WebAnimationClip);
        var ptr0 = clip.__destroy_into_raw();
        const ret = wasm.webanimationmixer_clipAction(this.__wbg_ptr, ptr0);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.webanimationmixer_new();
        this.__wbg_ptr = ret;
        WebAnimationMixerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebScene} scene
     * @param {number} delta
     */
    update(scene, delta) {
        _assertClass(scene, WebScene);
        wasm.webanimationmixer_update(this.__wbg_ptr, scene.__wbg_ptr, delta);
    }
}
if (Symbol.dispose) WebAnimationMixer.prototype[Symbol.dispose] = WebAnimationMixer.prototype.free;

export class WebArcballControls {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebArcballControlsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webarcballcontrols_free(ptr, 0);
    }
    /**
     * @param {WebCamera} camera
     */
    constructor(camera) {
        _assertClass(camera, WebCamera);
        const ret = wasm.webarcballcontrols_new(camera.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebArcballControlsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setTarget(x, y, z) {
        wasm.webarcballcontrols_setTarget(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {WebCamera} camera
     * @param {number} ndc_x
     * @param {number} ndc_y
     * @param {number} wheel
     * @param {boolean} rotating
     */
    update(camera, ndc_x, ndc_y, wheel, rotating) {
        _assertClass(camera, WebCamera);
        wasm.webarcballcontrols_update(this.__wbg_ptr, camera.__wbg_ptr, ndc_x, ndc_y, wheel, rotating);
    }
}
if (Symbol.dispose) WebArcballControls.prototype[Symbol.dispose] = WebArcballControls.prototype.free;

export class WebAudio {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAudioFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webaudio_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webaudio_new();
        this.__wbg_ptr = ret;
        WebAudioFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    play() {
        wasm.webaudio_play(this.__wbg_ptr);
    }
    /**
     * @param {boolean} l
     */
    setLoop(l) {
        wasm.webaudio_setLoop(this.__wbg_ptr, l);
    }
    /**
     * @param {number} v
     */
    setVolume(v) {
        wasm.webaudio_setVolume(this.__wbg_ptr, v);
    }
    stop() {
        wasm.webaudio_stop(this.__wbg_ptr);
    }
}
if (Symbol.dispose) WebAudio.prototype[Symbol.dispose] = WebAudio.prototype.free;

export class WebAudioListener {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAudioListenerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webaudiolistener_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webaudiolistener_new();
        this.__wbg_ptr = ret;
        WebAudioListenerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} v
     */
    setMasterVolume(v) {
        wasm.webaudiolistener_setMasterVolume(this.__wbg_ptr, v);
    }
}
if (Symbol.dispose) WebAudioListener.prototype[Symbol.dispose] = WebAudioListener.prototype.free;

export class WebAxesHelper {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebAxesHelperFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webaxeshelper_free(ptr, 0);
    }
    /**
     * @param {number} size
     */
    constructor(size) {
        const ret = wasm.webaxeshelper_new(size);
        this.__wbg_ptr = ret;
        WebAxesHelperFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebAxesHelper.prototype[Symbol.dispose] = WebAxesHelper.prototype.free;

export class WebBloomPass {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBloomPassFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webbloompass_free(ptr, 0);
    }
    /**
     * @param {number} _strength
     * @param {number} _radius
     * @param {number} _threshold
     */
    constructor(_strength, _radius, _threshold) {
        const ret = wasm.webbloompass_new(_strength, _radius, _threshold);
        this.__wbg_ptr = ret;
        WebBloomPassFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebBloomPass.prototype[Symbol.dispose] = WebBloomPass.prototype.free;

export class WebBox2 {
    static __wrap(ptr) {
        const obj = Object.create(WebBox2.prototype);
        obj.__wbg_ptr = ptr;
        WebBox2Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBox2Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webbox2_free(ptr, 0);
    }
    /**
     * @returns {WebBox2}
     */
    static empty() {
        const ret = wasm.webbox2_empty();
        return WebBox2.__wrap(ret);
    }
    /**
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.webbox2_isEmpty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {WebVector2} min
     * @param {WebVector2} max
     */
    constructor(min, max) {
        _assertClass(min, WebVector2);
        _assertClass(max, WebVector2);
        const ret = wasm.webbox2_new(min.__wbg_ptr, max.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebBox2Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebBox2.prototype[Symbol.dispose] = WebBox2.prototype.free;

export class WebBox3 {
    static __wrap(ptr) {
        const obj = Object.create(WebBox3.prototype);
        obj.__wbg_ptr = ptr;
        WebBox3Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBox3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webbox3_free(ptr, 0);
    }
    /**
     * @returns {WebVector3}
     */
    center() {
        const ret = wasm.webbox3_center(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebVector3} p
     * @returns {boolean}
     */
    containsPoint(p) {
        _assertClass(p, WebVector3);
        const ret = wasm.webbox3_containsPoint(this.__wbg_ptr, p.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {WebBox3}
     */
    static empty() {
        const ret = wasm.webbox3_empty();
        return WebBox3.__wrap(ret);
    }
    /**
     * @param {WebBox3} o
     * @returns {boolean}
     */
    intersectsBox(o) {
        _assertClass(o, WebBox3);
        const ret = wasm.webbox3_intersectsBox(this.__wbg_ptr, o.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.webbox3_isEmpty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {WebVector3} min
     * @param {WebVector3} max
     */
    constructor(min, max) {
        _assertClass(min, WebVector3);
        _assertClass(max, WebVector3);
        const ret = wasm.webbox3_new(min.__wbg_ptr, max.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebBox3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {WebVector3}
     */
    size() {
        const ret = wasm.webbox3_size(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
}
if (Symbol.dispose) WebBox3.prototype[Symbol.dispose] = WebBox3.prototype.free;

export class WebBoxHelper {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBoxHelperFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webboxhelper_free(ptr, 0);
    }
    /**
     * @param {WebBox3} bb
     */
    constructor(bb) {
        _assertClass(bb, WebBox3);
        const ret = wasm.webboxhelper_new(bb.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebBoxHelperFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebBoxHelper.prototype[Symbol.dispose] = WebBoxHelper.prototype.free;

export class WebBufferAttribute {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBufferAttributeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webbufferattribute_free(ptr, 0);
    }
    /**
     * @returns {Float32Array}
     */
    array() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webbufferattribute_array(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    count() {
        const ret = wasm.webbufferattribute_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get itemSize() {
        const ret = wasm.webbufferattribute_itemSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {Float32Array} array
     * @param {number} item_size
     */
    constructor(array, item_size) {
        const ptr0 = passArrayF32ToWasm0(array, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webbufferattribute_new(ptr0, len0, item_size);
        this.__wbg_ptr = ret;
        WebBufferAttributeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebBufferAttribute.prototype[Symbol.dispose] = WebBufferAttribute.prototype.free;

export class WebBufferGeometry {
    static __wrap(ptr) {
        const obj = Object.create(WebBufferGeometry.prototype);
        obj.__wbg_ptr = ptr;
        WebBufferGeometryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebBufferGeometryFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webbuffergeometry_free(ptr, 0);
    }
    /**
     * @returns {WebBox3}
     */
    computeBoundingBox() {
        const ret = wasm.webbuffergeometry_computeBoundingBox(this.__wbg_ptr);
        return WebBox3.__wrap(ret);
    }
    /**
     * @returns {WebSphere}
     */
    computeBoundingSphere() {
        const ret = wasm.webbuffergeometry_computeBoundingSphere(this.__wbg_ptr);
        return WebSphere.__wrap(ret);
    }
    computeVertexNormals() {
        wasm.webbuffergeometry_computeVertexNormals(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    drawCount() {
        const ret = wasm.webbuffergeometry_drawCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} name
     * @returns {boolean}
     */
    hasAttribute(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webbuffergeometry_hasAttribute(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.webbuffergeometry_new();
        this.__wbg_ptr = ret;
        WebBufferGeometryFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} name
     * @param {WebBufferAttribute} attr
     */
    setAttribute(name, attr) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(attr, WebBufferAttribute);
        var ptr1 = attr.__destroy_into_raw();
        wasm.webbuffergeometry_setAttribute(this.__wbg_ptr, ptr0, len0, ptr1);
    }
    /**
     * @param {Uint32Array} indices
     */
    setIndex(indices) {
        const ptr0 = passArray32ToWasm0(indices, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webbuffergeometry_setIndex(this.__wbg_ptr, ptr0, len0);
    }
}
if (Symbol.dispose) WebBufferGeometry.prototype[Symbol.dispose] = WebBufferGeometry.prototype.free;

/**
 * JS-visible camera that wraps either a perspective or orthographic camera.
 */
export class WebCamera {
    static __wrap(ptr) {
        const obj = Object.create(WebCamera.prototype);
        obj.__wbg_ptr = ptr;
        WebCameraFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCameraFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcamera_free(ptr, 0);
    }
    clearProjectionOverride() {
        wasm.webcamera_clearProjectionOverride(this.__wbg_ptr);
    }
    /**
     * Copy fov/near/far/aspect from another camera. Used by Reflector to
     * align its virtual camera with the main camera so the projective
     * texture matrix lines up.
     * @param {WebCamera} other
     */
    copyProjection(other) {
        _assertClass(other, WebCamera);
        wasm.webcamera_copyProjection(this.__wbg_ptr, other.__wbg_ptr);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    lookAt(x, y, z) {
        wasm.webcamera_lookAt(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {number} left
     * @param {number} right
     * @param {number} top
     * @param {number} bottom
     * @param {number} near
     * @param {number} far
     * @returns {WebCamera}
     */
    static orthographic(left, right, top, bottom, near, far) {
        const ret = wasm.webcamera_orthographic(left, right, top, bottom, near, far);
        return WebCamera.__wrap(ret);
    }
    /**
     * @param {number} fov_deg
     * @param {number} aspect
     * @param {number} near
     * @param {number} far
     * @returns {WebCamera}
     */
    static perspective(fov_deg, aspect, near, far) {
        const ret = wasm.webcamera_perspective(fov_deg, aspect, near, far);
        return WebCamera.__wrap(ret);
    }
    /**
     * Read back the column-major 4×4 projection matrix.
     * @returns {Float32Array}
     */
    projectionMatrix() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webcamera_projectionMatrix(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {WebVector3}
     */
    readPosition() {
        const ret = wasm.webcamera_readPosition(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @returns {WebVector3}
     */
    readTarget() {
        const ret = wasm.webcamera_readTarget(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {number} aspect
     */
    setAspect(aspect) {
        wasm.webcamera_setAspect(this.__wbg_ptr, aspect);
    }
    /**
     * Focus distance for DoF (three.js `camera.focus` is related but in different units;
     * here we store world-space distance).
     * @param {number} distance
     */
    setFocusDistance(distance) {
        wasm.webcamera_setFocusDistance(this.__wbg_ptr, distance);
    }
    /**
     * three.js `PerspectiveCamera.fov`, in degrees. No-op on orthographic.
     * @param {number} fov_deg
     */
    setFov(fov_deg) {
        wasm.webcamera_setFov(this.__wbg_ptr, fov_deg);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setPosition(x, y, z) {
        wasm.webcamera_setPosition(this.__wbg_ptr, x, y, z);
    }
    /**
     * Override the virtual camera projection (Reflector oblique near clip).
     * @param {Float32Array} elements
     */
    setProjectionOverride(elements) {
        const ptr0 = passArrayF32ToWasm0(elements, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webcamera_setProjectionOverride(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Lens shift as a fraction of the sensor (three.js `filmOffset` / filmGauge).
     * @param {number} shift_x
     * @param {number} shift_y
     */
    setShift(shift_x, shift_y) {
        wasm.webcamera_setShift(this.__wbg_ptr, shift_x, shift_y);
    }
    /**
     * Set the camera's up vector. Needed by CubeCamera face cameras whose
     * +Y/-Y views look straight up/down — with the default up of (0,1,0)
     * those views become degenerate (lookAt parallel to up).
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setUp(x, y, z) {
        wasm.webcamera_setUp(this.__wbg_ptr, x, y, z);
    }
    /**
     * Atomic eye + look-at (+ optional FOV) update for cinematic animation.
     * Pass `fov_deg < 0` to leave FOV unchanged. One wasm call per frame
     * instead of separate `setPosition` / `lookAt` / `setFov`.
     * @param {number} px
     * @param {number} py
     * @param {number} pz
     * @param {number} tx
     * @param {number} ty
     * @param {number} tz
     * @param {number} fov_deg
     */
    setView(px, py, pz, tx, ty, tz, fov_deg) {
        wasm.webcamera_setView(this.__wbg_ptr, px, py, pz, tx, ty, tz, fov_deg);
    }
    /**
     * Read back the column-major 4×4 view matrix (camera.matrixWorldInverse
     * in three.js terms). Needed by Reflector/Refractor to build the
     * projective texture matrix for their reflected camera.
     * @returns {Float32Array}
     */
    viewMatrix() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webcamera_viewMatrix(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebCamera.prototype[Symbol.dispose] = WebCamera.prototype.free;

export class WebCatmullRomCurve3 {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCatmullRomCurve3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcatmullromcurve3_free(ptr, 0);
    }
    /**
     * @param {Float32Array} points_flat
     */
    constructor(points_flat) {
        const ptr0 = passArrayF32ToWasm0(points_flat, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webcatmullromcurve3_new(ptr0, len0);
        this.__wbg_ptr = ret;
        WebCatmullRomCurve3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebCatmullRomCurve3.prototype[Symbol.dispose] = WebCatmullRomCurve3.prototype.free;

export class WebClock {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebClockFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webclock_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    getDelta() {
        const ret = wasm.webclock_getDelta(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getElapsedTime() {
        const ret = wasm.webclock_getElapsedTime(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.webclock_new();
        this.__wbg_ptr = ret;
        WebClockFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebClock.prototype[Symbol.dispose] = WebClock.prototype.free;

export class WebColladaLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebColladaLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcolladaloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webcolladaloader_new();
        this.__wbg_ptr = ret;
        WebColladaLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} src
     * @returns {WebGeometry}
     */
    parse(src) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(src, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webcolladaloader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebGeometry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebColladaLoader.prototype[Symbol.dispose] = WebColladaLoader.prototype.free;

export class WebColor {
    static __wrap(ptr) {
        const obj = Object.create(WebColor.prototype);
        obj.__wbg_ptr = ptr;
        WebColorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebColorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcolor_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    b() {
        const ret = wasm.webcolor_b(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} hex
     * @returns {WebColor}
     */
    static fromHex(hex) {
        const ret = wasm.webcolor_fromHex(hex);
        return WebColor.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    g() {
        const ret = wasm.webcolor_g(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    getHex() {
        const ret = wasm.webcolor_getHex(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {WebColor} other
     * @param {number} t
     * @returns {WebColor}
     */
    lerp(other, t) {
        _assertClass(other, WebColor);
        const ret = wasm.webcolor_lerp(this.__wbg_ptr, other.__wbg_ptr, t);
        return WebColor.__wrap(ret);
    }
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    constructor(r, g, b) {
        const ret = wasm.webcolor_new(r, g, b);
        this.__wbg_ptr = ret;
        WebColorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    r() {
        const ret = wasm.webcolor_r(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} h
     * @returns {WebColor}
     */
    setHex(h) {
        const ret = wasm.webcolor_setHex(this.__wbg_ptr, h);
        return WebColor.__wrap(ret);
    }
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {WebColor}
     */
    setRGB(r, g, b) {
        const ret = wasm.webcolor_setRGB(this.__wbg_ptr, r, g, b);
        return WebColor.__wrap(ret);
    }
}
if (Symbol.dispose) WebColor.prototype[Symbol.dispose] = WebColor.prototype.free;

export class WebCss2dRenderer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCss2dRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcss2drenderer_free(ptr, 0);
    }
    /**
     * @param {number} w
     * @param {number} h
     */
    constructor(w, h) {
        const ret = wasm.webcss2drenderer_new(w, h);
        this.__wbg_ptr = ret;
        WebCss2dRendererFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebCss2dRenderer.prototype[Symbol.dispose] = WebCss2dRenderer.prototype.free;

export class WebCubeRenderTarget {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCubeRenderTargetFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcuberendertarget_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.__wbg_get_webcuberendertarget_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get side() {
        const ret = wasm.__wbg_get_webcuberendertarget_side(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set id(arg0) {
        wasm.__wbg_set_webcuberendertarget_id(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set side(arg0) {
        wasm.__wbg_set_webcuberendertarget_side(this.__wbg_ptr, arg0);
    }
    /**
     * @param {WebRenderer} renderer
     * @param {number} side
     */
    constructor(renderer, side) {
        _assertClass(renderer, WebRenderer);
        const ret = wasm.webcuberendertarget_new(renderer.__wbg_ptr, side);
        this.__wbg_ptr = ret;
        WebCubeRenderTargetFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebCubeRenderTarget.prototype[Symbol.dispose] = WebCubeRenderTarget.prototype.free;

export class WebCubeTexture {
    static __wrap(ptr) {
        const obj = Object.create(WebCubeTexture.prototype);
        obj.__wbg_ptr = ptr;
        WebCubeTextureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCubeTextureFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcubetexture_free(ptr, 0);
    }
    /**
     * @param {number} size
     * @param {Uint8Array} px
     * @param {Uint8Array} nx
     * @param {Uint8Array} py
     * @param {Uint8Array} ny
     * @param {Uint8Array} pz
     * @param {Uint8Array} nz
     */
    constructor(size, px, nx, py, ny, pz, nz) {
        const ptr0 = passArray8ToWasm0(px, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(nx, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(py, wasm.__wbindgen_export);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(ny, wasm.__wbindgen_export);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(pz, wasm.__wbindgen_export);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passArray8ToWasm0(nz, wasm.__wbindgen_export);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.webcubetexture_new(size, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        this.__wbg_ptr = ret;
        WebCubeTextureFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @param {number} roughness
     * @returns {Float32Array}
     */
    sampleCubeUvEnv(dx, dy, dz, roughness) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webcubetexture_sampleCubeUvEnv(retptr, this.__wbg_ptr, dx, dy, dz, roughness);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get size() {
        const ret = wasm.webcubetexture_size(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WebCubeTexture.prototype[Symbol.dispose] = WebCubeTexture.prototype.free;

export class WebCylindrical {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebCylindricalFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webcylindrical_free(ptr, 0);
    }
    /**
     * @param {number} radius
     * @param {number} theta
     * @param {number} y
     */
    constructor(radius, theta, y) {
        const ret = wasm.webcylindrical_new(radius, theta, y);
        this.__wbg_ptr = ret;
        WebCylindricalFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebCylindrical.prototype[Symbol.dispose] = WebCylindrical.prototype.free;

export class WebDataTexture {
    static __wrap(ptr) {
        const obj = Object.create(WebDataTexture.prototype);
        obj.__wbg_ptr = ptr;
        WebDataTextureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebDataTextureFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webdatatexture_free(ptr, 0);
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {Uint8Array} data
     */
    constructor(width, height, data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webdatatexture_new(width, height, ptr0, len0);
        this.__wbg_ptr = ret;
        WebDataTextureFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * A texture whose bytes are sRGB-encoded — what every JPEG and PNG colour
     * map is.
     *
     * The default constructor uploads `Rgba8Unorm`, i.e. the sampler reads the
     * bytes as linear. Feeding it an ordinary image makes the darks far too
     * bright; this asks the hardware to decode instead, which is both correct
     * and free. Use it for colour maps, never for normal/roughness data.
     * @param {number} width
     * @param {number} height
     * @param {Uint8Array} data
     * @returns {WebDataTexture}
     */
    static newSrgb(width, height, data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webdatatexture_newSrgb(width, height, ptr0, len0);
        return WebDataTexture.__wrap(ret);
    }
    /**
     * Replace RGBA8 level-0 bytes without allocating a new texture id.
     * @param {Uint8Array} data
     * @returns {boolean}
     */
    replaceRgba(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webdatatexture_replaceRgba(this.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {number} mag
     * @param {number} _min
     * @param {number} wrap_s
     * @param {number} wrap_t
     */
    setFilters(mag, _min, wrap_s, wrap_t) {
        wasm.webdatatexture_setFilters(this.__wbg_ptr, mag, _min, wrap_s, wrap_t);
    }
    /**
     * three.js `Texture.offset` / `Texture.repeat` — the UV sub-rectangle this
     * texture covers. What lets several meshes share one atlas.
     * @param {number} ox
     * @param {number} oy
     * @param {number} rx
     * @param {number} ry
     */
    setUvTransform(ox, oy, rx, ry) {
        wasm.webdatatexture_setUvTransform(this.__wbg_ptr, ox, oy, rx, ry);
    }
    /**
     * A second handle on the same pixels, carrying its own UV transform.
     *
     * `Texture`'s bytes live behind their own `Arc`, so this clones a handle
     * and not an image — and the renderer keys its GPU cache on those bytes,
     * so every view of one buffer shares a single upload between them.
     * @param {number} ox
     * @param {number} oy
     * @param {number} rx
     * @param {number} ry
     * @returns {WebDataTexture}
     */
    view(ox, oy, rx, ry) {
        const ret = wasm.webdatatexture_view(this.__wbg_ptr, ox, oy, rx, ry);
        return WebDataTexture.__wrap(ret);
    }
}
if (Symbol.dispose) WebDataTexture.prototype[Symbol.dispose] = WebDataTexture.prototype.free;

export class WebEffectComposer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebEffectComposerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webeffectcomposer_free(ptr, 0);
    }
    /**
     * EffectComposer construction requires a wgpu device; the wasm path
     * builds one internally with the renderer. Use `renderer.composer()`
     * to obtain a composer bound to the same surface.
     */
    constructor() {
        const ret = wasm.webeffectcomposer_new();
        this.__wbg_ptr = ret;
        WebEffectComposerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebEffectComposer.prototype[Symbol.dispose] = WebEffectComposer.prototype.free;

export class WebEllipseCurve {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebEllipseCurveFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webellipsecurve_free(ptr, 0);
    }
    /**
     * @param {number} cx
     * @param {number} cy
     * @param {number} rx
     * @param {number} ry
     * @param {number} a0
     * @param {number} a1
     * @param {boolean} clockwise
     * @param {number} rot
     */
    constructor(cx, cy, rx, ry, a0, a1, clockwise, rot) {
        const ret = wasm.webellipsecurve_new(cx, cy, rx, ry, a0, a1, clockwise, rot);
        this.__wbg_ptr = ret;
        WebEllipseCurveFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebEllipseCurve.prototype[Symbol.dispose] = WebEllipseCurve.prototype.free;

export class WebEuler {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebEulerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webeuler_free(ptr, 0);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x, y, z) {
        const ret = wasm.webeuler_new(x, y, z);
        this.__wbg_ptr = ret;
        WebEulerFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.webeuler_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.webeuler_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.webeuler_z(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WebEuler.prototype[Symbol.dispose] = WebEuler.prototype.free;

export class WebExrLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebExrLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webexrloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webexrloader_new();
        this.__wbg_ptr = ret;
        WebExrLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WebTexture}
     */
    parse(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webexrloader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebTexture.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Decode to half-float instead of clipping to 8 bits.
     *
     * EXR is scene-referred, and a star map is the extreme case: over half of
     * NASA's Deep Star Maps sits below a hundredth of full scale, so the 8-bit
     * path leaves the galaxy as a handful of grey dots.
     * @param {Uint8Array} bytes
     * @returns {WebTexture}
     */
    parseHdr(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webexrloader_parseHdr(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebTexture.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebExrLoader.prototype[Symbol.dispose] = WebExrLoader.prototype.free;

export class WebFbxLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebFbxLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webfbxloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webfbxloader_new();
        this.__wbg_ptr = ret;
        WebFbxLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WebGeometry}
     */
    parse(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webfbxloader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebGeometry.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebFbxLoader.prototype[Symbol.dispose] = WebFbxLoader.prototype.free;

export class WebFirstPersonControls {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebFirstPersonControlsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webfirstpersoncontrols_free(ptr, 0);
    }
    /**
     * @param {WebCamera} camera
     */
    constructor(camera) {
        _assertClass(camera, WebCamera);
        const ret = wasm.webfirstpersoncontrols_new(camera.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebFirstPersonControlsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} forward
     * @param {number} right
     * @param {number} up
     */
    setMoveInput(forward, right, up) {
        wasm.webfirstpersoncontrols_setMoveInput(this.__wbg_ptr, forward, right, up);
    }
    /**
     * @param {WebCamera} camera
     * @param {number} dx
     * @param {number} dy
     * @param {number} dt
     * @param {boolean} rotating
     */
    update(camera, dx, dy, dt, rotating) {
        _assertClass(camera, WebCamera);
        wasm.webfirstpersoncontrols_update(this.__wbg_ptr, camera.__wbg_ptr, dx, dy, dt, rotating);
    }
}
if (Symbol.dispose) WebFirstPersonControls.prototype[Symbol.dispose] = WebFirstPersonControls.prototype.free;

export class WebFrustum {
    static __wrap(ptr) {
        const obj = Object.create(WebFrustum.prototype);
        obj.__wbg_ptr = ptr;
        WebFrustumFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebFrustumFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webfrustum_free(ptr, 0);
    }
    /**
     * @param {WebVector3} p
     * @returns {boolean}
     */
    containsPoint(p) {
        _assertClass(p, WebVector3);
        const ret = wasm.webfrustum_containsPoint(this.__wbg_ptr, p.__wbg_ptr);
        return ret !== 0;
    }
    constructor() {
        const ret = wasm.webfrustum_new();
        this.__wbg_ptr = ret;
        WebFrustumFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebMatrix4} m
     * @returns {WebFrustum}
     */
    static setFromProjectionMatrix(m) {
        _assertClass(m, WebMatrix4);
        const ret = wasm.webfrustum_setFromProjectionMatrix(m.__wbg_ptr);
        return WebFrustum.__wrap(ret);
    }
}
if (Symbol.dispose) WebFrustum.prototype[Symbol.dispose] = WebFrustum.prototype.free;

export class WebFxaaPass {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebFxaaPassFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webfxaapass_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webfxaapass_new();
        this.__wbg_ptr = ret;
        WebFxaaPassFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebFxaaPass.prototype[Symbol.dispose] = WebFxaaPass.prototype.free;

export class WebGeometry {
    static __wrap(ptr) {
        const obj = Object.create(WebGeometry.prototype);
        obj.__wbg_ptr = ptr;
        WebGeometryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebGeometryFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webgeometry_free(ptr, 0);
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {number} depth
     * @returns {WebGeometry}
     */
    static box(width, height, depth) {
        const ret = wasm.webgeometry_box(width, height, depth);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} w
     * @param {number} h
     * @param {number} d
     * @returns {WebGeometry}
     */
    static boxLine(w, h, d) {
        const ret = wasm.webgeometry_boxLine(w, h, d);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} length
     * @param {number} cap_segments
     * @param {number} radial_segments
     * @returns {WebGeometry}
     */
    static capsule(radius, length, cap_segments, radial_segments) {
        const ret = wasm.webgeometry_capsule(radius, length, cap_segments, radial_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} segments
     * @returns {WebGeometry}
     */
    static circle(radius, segments) {
        const ret = wasm.webgeometry_circle(radius, segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} height
     * @param {number} radial_segments
     * @returns {WebGeometry}
     */
    static cone(radius, height, radial_segments) {
        const ret = wasm.webgeometry_cone(radius, height, radial_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * Discrete cuboct assembly — exploded face parts, optional vertex colors.
     * @param {number} variant
     * @param {number} pitch
     * @param {number} cells
     * @param {number} explode
     * @param {boolean} colored
     * @returns {WebGeometry}
     */
    static cuboctAssembly(variant, pitch, cells, explode, colored) {
        const ret = wasm.webgeometry_cuboctAssembly(variant, pitch, cells, explode, colored);
        return WebGeometry.__wrap(ret);
    }
    /**
     * 2D laser-cut profile for one cuboct face (mm).
     * @param {number} variant
     * @param {number} pitch
     * @param {number} shape
     * @returns {string}
     */
    static cuboctFaceSvg(variant, pitch, shape) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webgeometry_cuboctFaceSvg(retptr, variant, pitch, shape);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Face-connected cuboct continuum lattice (Jenett et al. Sci. Adv. 2020).
     *
     * `variant`: 0 rigid, 1 compliant, 2 auxetic, 3 chiral CW, 4 chiral CCW.
     * @param {number} variant
     * @param {number} size
     * @param {number} cells
     * @param {number} resolution
     * @param {number} shape
     * @returns {WebGeometry}
     */
    static cuboctLattice(variant, size, cells, resolution, shape) {
        const ret = wasm.webgeometry_cuboctLattice(variant, size, cells, resolution, shape);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius_top
     * @param {number} radius_bottom
     * @param {number} height
     * @param {number} radial_segments
     * @returns {WebGeometry}
     */
    static cylinder(radius_top, radius_bottom, height, radial_segments) {
        const ret = wasm.webgeometry_cylinder(radius_top, radius_bottom, height, radial_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} detail
     * @returns {WebGeometry}
     */
    static dodecahedron(radius, detail) {
        const ret = wasm.webgeometry_dodecahedron(radius, detail);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {WebBufferGeometry} g
     * @returns {WebGeometry}
     */
    static fromBufferGeometry(g) {
        _assertClass(g, WebBufferGeometry);
        var ptr0 = g.__destroy_into_raw();
        const ret = wasm.webgeometry_fromBufferGeometry(ptr0);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} detail
     * @returns {WebGeometry}
     */
    static icosahedron(radius, detail) {
        const ret = wasm.webgeometry_icosahedron(radius, detail);
        return WebGeometry.__wrap(ret);
    }
    /**
     * Kirigami Expanded Miura plate lattice.
     *
     * `variant`: preset index with slot [`KIRIGAMI_NET_VARIANT`] = developed 2D net.
     * See [`KirigamiPreset::from_variant`].
     * @param {number} variant
     * @param {number} nx
     * @param {number} ny
     * @param {number} thickness
     * @returns {WebGeometry}
     */
    static kirigami(variant, nx, ny, thickness) {
        const ret = wasm.webgeometry_kirigami(variant, nx, ny, thickness);
        return WebGeometry.__wrap(ret);
    }
    /**
     * Developed crease-pattern SVG (mm) for a preset or the planar net fallback.
     * @param {number} variant
     * @param {number} nx
     * @param {number} ny
     * @returns {string}
     */
    static kirigamiNetSvg(variant, nx, ny) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webgeometry_kirigamiNetSvg(retptr, variant, nx, ny);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {number} radius
     * @param {number} detail
     * @returns {WebGeometry}
     */
    static octahedron(radius, detail) {
        const ret = wasm.webgeometry_octahedron(radius, detail);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} width
     * @param {number} height
     * @returns {WebGeometry}
     */
    static plane(width, height) {
        const ret = wasm.webgeometry_plane(width, height);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} inner
     * @param {number} outer
     * @param {number} theta_segments
     * @returns {WebGeometry}
     */
    static ring(inner, outer, theta_segments) {
        const ret = wasm.webgeometry_ring(inner, outer, theta_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} w_segments
     * @param {number} h_segments
     * @returns {WebGeometry}
     */
    static sphere(radius, w_segments, h_segments) {
        const ret = wasm.webgeometry_sphere(radius, w_segments, h_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * A sphere patch — three.js's `phiStart/phiLength/thetaStart/thetaLength`.
     *
     * UVs span 0..1 across the patch, not across the whole sphere, so each
     * patch can carry its own texture. That is what makes a tiled globe
     * possible without a single texture past the 8192 device limit.
     * @param {number} radius
     * @param {number} w_segments
     * @param {number} h_segments
     * @param {number} phi_start
     * @param {number} phi_length
     * @param {number} theta_start
     * @param {number} theta_length
     * @returns {WebGeometry}
     */
    static sphereRange(radius, w_segments, h_segments, phi_start, phi_length, theta_start, theta_length) {
        const ret = wasm.webgeometry_sphereRange(radius, w_segments, h_segments, phi_start, phi_length, theta_start, theta_length);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} detail
     * @returns {WebGeometry}
     */
    static tetrahedron(radius, detail) {
        const ret = wasm.webgeometry_tetrahedron(radius, detail);
        return WebGeometry.__wrap(ret);
    }
    /**
     * Clone into a `WebBufferGeometry` handle (same underlying data).
     * @returns {WebBufferGeometry}
     */
    toBufferGeometry() {
        const ret = wasm.webgeometry_toBufferGeometry(this.__wbg_ptr);
        return WebBufferGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} tube
     * @param {number} radial_segments
     * @param {number} tubular_segments
     * @returns {WebGeometry}
     */
    static torus(radius, tube, radial_segments, tubular_segments) {
        const ret = wasm.webgeometry_torus(radius, tube, radial_segments, tubular_segments);
        return WebGeometry.__wrap(ret);
    }
    /**
     * @param {number} radius
     * @param {number} tube
     * @param {number} tubular_segments
     * @param {number} radial_segments
     * @param {number} p
     * @param {number} q
     * @returns {WebGeometry}
     */
    static torusKnot(radius, tube, tubular_segments, radial_segments, p, q) {
        const ret = wasm.webgeometry_torusKnot(radius, tube, tubular_segments, radial_segments, p, q);
        return WebGeometry.__wrap(ret);
    }
}
if (Symbol.dispose) WebGeometry.prototype[Symbol.dispose] = WebGeometry.prototype.free;

/**
 * Writing glTF from the browser, which is how a scene edited there gets out.
 */
export class WebGltfExporter {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebGltfExporterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webgltfexporter_free(ptr, 0);
    }
    /**
     * One geometry as a self-contained `.glb`.
     * @param {WebGeometry} geometry
     * @returns {Uint8Array}
     */
    geometry_to_glb(geometry) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(geometry, WebGeometry);
            wasm.webgltfexporter_geometry_to_glb(retptr, this.__wbg_ptr, geometry.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    constructor() {
        const ret = wasm.webgltfexporter_new();
        this.__wbg_ptr = ret;
        WebGltfExporterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebGltfExporter.prototype[Symbol.dispose] = WebGltfExporter.prototype.free;

export class WebGridHelper {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebGridHelperFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webgridhelper_free(ptr, 0);
    }
    /**
     * @param {number} size
     * @param {number} divisions
     * @param {number} color1
     * @param {number} color2
     */
    constructor(size, divisions, color1, color2) {
        const ret = wasm.webgridhelper_new(size, divisions, color1, color2);
        this.__wbg_ptr = ret;
        WebGridHelperFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebGridHelper.prototype[Symbol.dispose] = WebGridHelper.prototype.free;

export class WebHdrLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebHdrLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webhdrloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webhdrloader_new();
        this.__wbg_ptr = ret;
        WebHdrLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WebTexture}
     */
    parse(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webhdrloader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebTexture.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebHdrLoader.prototype[Symbol.dispose] = WebHdrLoader.prototype.free;

/**
 * One planar 3R arm with geometric IK, actuator plant, capsule solids,
 * joint reports, and world contacts (floor + obstacle).
 *
 * `kind`: `"direct"` | `"qdd"` | `"high"` | `"hydraulic"` | `"tendon"`.
 * Lengths are millimetres.
 */
export class WebIkServoPlant {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebIkServoPlantFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webikservoplant_free(ptr, 0);
    }
    /**
     * Flat link solids: per body
     * `[ox,oy,oz, dx,dy,dz, radius, mass, volume, mat_id, rgb_r,rgb_g,rgb_b, metal, rough]`.
     * `mat_id`: 0 aluminum, 1 steel, 2 plastic, 3 rubber.
     * @returns {Float64Array}
     */
    bodiesFlat() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_bodiesFlat(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get bodyCount() {
        const ret = wasm.webikservoplant_bodyCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Body names, newline-separated.
     * @returns {string}
     */
    bodyNames() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_bodyNames(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get contactCount() {
        const ret = wasm.webikservoplant_contactCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * `"a|b"` pairs, newline-separated, matching [`Self::contacts_flat`] order.
     * @returns {string}
     */
    contactPairs() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_contactPairs(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Flat contacts: `[px,py,pz, nx,ny,nz, depth, …]` plus parallel name pairs
     * via [`Self::contact_pairs`].
     * @returns {Float64Array}
     */
    contactsFlat() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_contactsFlat(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Mechanical design label (e.g. "harmonic + planetary 288:1").
     * @returns {string}
     */
    designLabel() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_designLabel(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    designPartCount() {
        const ret = wasm.webikservoplant_designPartCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Assembled mechanism parts in world mm.
     * Stride 16: `[joint, role, ox,oy,oz, ax,ay,az, radius, length, r,g,b, metal, rough, shape]`.
     * `role`: motor=0 … encoder=14, housing=15.
     * `shape`: capsule=0, segment=1, disk=2.
     * @returns {Float64Array}
     */
    designPartsFlat() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_designPartsFlat(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    driveKind() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_driveKind(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Fluid kinematic viscosity at current temp, cSt (hydraulic only).
     * @returns {number}
     */
    fluidNuCst() {
        const ret = wasm.webikservoplant_fluidNuCst(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float64Array}
     */
    hingesAct() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_hingesAct(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get jointCount() {
        const ret = wasm.webikservoplant_jointCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Joint names, newline-separated.
     * @returns {string}
     */
    jointNames() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_jointNames(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Flat joints: per hinge
     * `[ox,oy,oz, ax,ay,az, angle, cmd, omega, lo, hi, torque, engaged]`.
     * @returns {Float64Array}
     */
    jointsFlat() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_jointsFlat(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {string}
     */
    get label() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_label(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Working fluid / cable / grease name.
     * @returns {string}
     */
    materialName() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_materialName(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    meanJointErr() {
        const ret = wasm.webikservoplant_meanJointErr(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} kind
     */
    constructor(kind) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webikservoplant_new(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            WebIkServoPlantFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    qAct() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_qAct(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    qCmd() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_qCmd(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Gear reduction N, or `1` for hydraulic / tendon.
     * @returns {number}
     */
    ratio() {
        const ret = wasm.webikservoplant_ratio(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    reflectedInertia() {
        const ret = wasm.webikservoplant_reflectedInertia(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Float64Array} q_deg
     */
    seed(q_deg) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(q_deg, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webikservoplant_seed(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Swap hydraulic fluid: `iso32|iso46|iso68|water-glycol|silicone`.
     * @param {string} name
     */
    setFluid(name) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webikservoplant_setFluid(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Operating temperature in °C (oil, grease, cable).
     * @param {number} temp_c
     */
    setTemp(temp_c) {
        wasm.webikservoplant_setTemp(this.__wbg_ptr, temp_c);
    }
    /**
     * Swap tendon material: `steel|uhmwpe|nylon|aramid`.
     * @param {string} name
     */
    setTendon(name) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webikservoplant_setTendon(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    skeletonAct() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_skeletonAct(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    skeletonCmd() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_skeletonCmd(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * IK + plant step. Returns tip position error in millimetres.
     * @param {number} tx
     * @param {number} ty
     * @param {number} tz
     * @param {number} ax
     * @param {number} ay
     * @param {number} az
     * @param {number} dt
     * @returns {number}
     */
    step(tx, ty, tz, ax, ay, az, dt) {
        const ret = wasm.webikservoplant_step(this.__wbg_ptr, tx, ty, tz, ax, ay, az, dt);
        return ret;
    }
    /**
     * @returns {number}
     */
    tempC() {
        const ret = wasm.webikservoplant_tempC(this.__wbg_ptr);
        return ret;
    }
    /**
     * Live agonist/antagonist tensions for joint 0, N: `[T+, T−, pretension]`.
     * @returns {Float64Array}
     */
    tensions0() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_tensions0(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    tipAct() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_tipAct(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {Float64Array}
     */
    tipCmd() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_tipCmd(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Obstacle AABB `[xmin,ymin,zmin, xmax,ymax,zmax]` and floor z as 7th value.
     * @returns {Float64Array}
     */
    worldBounds() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webikservoplant_worldBounds(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebIkServoPlant.prototype[Symbol.dispose] = WebIkServoPlant.prototype.free;

/**
 * KTX2 textures, which is how a browser gets a GPU-compressed one.
 *
 * The container is read here; a Basis Universal payload still needs
 * transcoding and is reported as such rather than returned as noise.
 */
export class WebKtx2Loader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebKtx2LoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webktx2loader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webktx2loader_new();
        this.__wbg_ptr = ret;
        WebKtx2LoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The base mip level as raw bytes, with the format and size reported
     * separately — a compressed payload is not pixels and must not be handed
     * back as if it were.
     * @param {Uint8Array} bytes
     * @returns {WebKtx2Texture}
     */
    parse(bytes) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.webktx2loader_parse(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebKtx2Texture.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) WebKtx2Loader.prototype[Symbol.dispose] = WebKtx2Loader.prototype.free;

export class WebKtx2Texture {
    static __wrap(ptr) {
        const obj = Object.create(WebKtx2Texture.prototype);
        obj.__wbg_ptr = ptr;
        WebKtx2TextureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebKtx2TextureFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webktx2texture_free(ptr, 0);
    }
    /**
     * Whether the bytes are blocks rather than pixels, which decides whether a
     * caller may index them.
     * @returns {boolean}
     */
    get block_compressed() {
        const ret = wasm.__wbg_get_webktx2texture_block_compressed(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_webktx2texture_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_webktx2texture_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {string}
     */
    get format() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webktx2texture_format(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * One mip level's bytes, largest first.
     * @param {number} index
     * @returns {Uint8Array | undefined}
     */
    level(index) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webktx2texture_level(retptr, this.__wbg_ptr, index);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getArrayU8FromWasm0(r0, r1).slice();
                wasm.__wbindgen_export4(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get level_count() {
        const ret = wasm.webktx2texture_level_count(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WebKtx2Texture.prototype[Symbol.dispose] = WebKtx2Texture.prototype.free;

export class WebLight {
    static __wrap(ptr) {
        const obj = Object.create(WebLight.prototype);
        obj.__wbg_ptr = ptr;
        WebLightFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebLightFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_weblight_free(ptr, 0);
    }
    /**
     * @param {WebColor} color
     * @param {number} intensity
     * @returns {WebLight}
     */
    static ambient(color, intensity) {
        _assertClass(color, WebColor);
        const ret = wasm.weblight_ambient(color.__wbg_ptr, intensity);
        return WebLight.__wrap(ret);
    }
    /**
     * Diagnostic: dump kind + key state as a string. Lets parity tests assert
     * that JS-side mutations actually landed on the wasm side.
     * @returns {string}
     */
    debugString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.weblight_debugString(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {WebColor} color
     * @param {number} intensity
     * @returns {WebLight}
     */
    static directional(color, intensity) {
        _assertClass(color, WebColor);
        const ret = wasm.weblight_directional(color.__wbg_ptr, intensity);
        return WebLight.__wrap(ret);
    }
    /**
     * @param {WebColor} sky
     * @param {WebColor} ground
     * @param {number} intensity
     * @returns {WebLight}
     */
    static hemisphere(sky, ground, intensity) {
        _assertClass(sky, WebColor);
        _assertClass(ground, WebColor);
        const ret = wasm.weblight_hemisphere(sky.__wbg_ptr, ground.__wbg_ptr, intensity);
        return WebLight.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} intensity
     * @param {number} distance
     * @param {number} decay
     * @returns {WebLight}
     */
    static point(color, intensity, distance, decay) {
        _assertClass(color, WebColor);
        const ret = wasm.weblight_point(color.__wbg_ptr, intensity, distance, decay);
        return WebLight.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} intensity
     * @param {number} width
     * @param {number} height
     * @returns {WebLight}
     */
    static rectArea(color, intensity, width, height) {
        _assertClass(color, WebColor);
        const ret = wasm.weblight_rectArea(color.__wbg_ptr, intensity, width, height);
        return WebLight.__wrap(ret);
    }
    /**
     * Toggle whether this light casts shadows. Only Directional / Spot /
     * Point variants honor it — the renderer picks the first cast_shadow=true
     * light of each kind as that frame's shadow caster.
     * @param {boolean} cast
     */
    setCastShadow(cast) {
        wasm.weblight_setCastShadow(this.__wbg_ptr, cast);
    }
    /**
     * Set the direction the light shines toward (only meaningful for
     * Directional / Spot lights). Vector does not need to be normalized.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setDirection(x, y, z) {
        wasm.weblight_setDirection(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {number} intensity
     */
    setIntensity(intensity) {
        wasm.weblight_setIntensity(this.__wbg_ptr, intensity);
    }
    /**
     * Orthographic shadow frustum (three.js `light.shadow.camera.*`).
     * @param {number} left
     * @param {number} right
     * @param {number} top
     * @param {number} bottom
     * @param {number} near
     * @param {number} far
     */
    setShadowCamera(left, right, top, bottom, near, far) {
        wasm.weblight_setShadowCamera(this.__wbg_ptr, left, right, top, bottom, near, far);
    }
    /**
     * Shadow-map resolution, depth bias, normal bias, and view fitting
     * (`ShadowSettings::fit_view`: 0 keeps the fixed box, > 0 fits the
     * directional box to the camera out to that distance).
     * @param {number} map_size
     * @param {number} bias
     * @param {number} normal_bias
     * @param {number} fit_view
     */
    setShadowParams(map_size, bias, normal_bias, fit_view) {
        wasm.weblight_setShadowParams(this.__wbg_ptr, map_size, bias, normal_bias, fit_view);
    }
    /**
     * @param {WebColor} color
     * @param {number} intensity
     * @param {number} distance
     * @param {number} angle
     * @param {number} penumbra
     * @param {number} decay
     * @returns {WebLight}
     */
    static spot(color, intensity, distance, angle, penumbra, decay) {
        _assertClass(color, WebColor);
        const ret = wasm.weblight_spot(color.__wbg_ptr, intensity, distance, angle, penumbra, decay);
        return WebLight.__wrap(ret);
    }
}
if (Symbol.dispose) WebLight.prototype[Symbol.dispose] = WebLight.prototype.free;

export class WebLine3 {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebLine3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webline3_free(ptr, 0);
    }
    /**
     * @returns {WebVector3}
     */
    center() {
        const ret = wasm.webline3_center(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    distance() {
        const ret = wasm.webline3_distance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WebVector3} start
     * @param {WebVector3} end
     */
    constructor(start, end) {
        _assertClass(start, WebVector3);
        _assertClass(end, WebVector3);
        const ret = wasm.webline3_new(start.__wbg_ptr, end.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebLine3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebLine3.prototype[Symbol.dispose] = WebLine3.prototype.free;

export class WebLineCurve {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebLineCurveFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_weblinecurve_free(ptr, 0);
    }
    /**
     * @param {WebVector2} v1
     * @param {WebVector2} v2
     */
    constructor(v1, v2) {
        _assertClass(v1, WebVector2);
        _assertClass(v2, WebVector2);
        const ret = wasm.weblinecurve_new(v1.__wbg_ptr, v2.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebLineCurveFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebLineCurve.prototype[Symbol.dispose] = WebLineCurve.prototype.free;

export class WebLineCurve3 {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebLineCurve3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_weblinecurve3_free(ptr, 0);
    }
    /**
     * @param {WebVector3} v1
     * @param {WebVector3} v2
     */
    constructor(v1, v2) {
        _assertClass(v1, WebVector3);
        _assertClass(v2, WebVector3);
        const ret = wasm.weblinecurve3_new(v1.__wbg_ptr, v2.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebLineCurve3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebLineCurve3.prototype[Symbol.dispose] = WebLineCurve3.prototype.free;

export class WebMarchingCubes {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMarchingCubesFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmarchingcubes_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webmarchingcubes_new();
        this.__wbg_ptr = ret;
        WebMarchingCubesFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebMarchingCubes.prototype[Symbol.dispose] = WebMarchingCubes.prototype.free;

export class WebMaterial {
    static __wrap(ptr) {
        const obj = Object.create(WebMaterial.prototype);
        obj.__wbg_ptr = ptr;
        WebMaterialFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMaterialFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmaterial_free(ptr, 0);
    }
    /**
     * Attach a roughness map (three.js `material.roughnessMap`). Sampled from
     * the green channel, and multiplied by `material.roughness`.
     * An analytic planetary atmosphere — see
     * [`AtmosphereMaterial`](crate::AtmosphereMaterial). Put it on a sphere a
     * little larger than the planet, sharing its centre.
     * @param {number} planet_radius
     * @param {number} atmosphere_radius
     * @returns {WebMaterial}
     */
    static atmosphere(planet_radius, atmosphere_radius) {
        const ret = wasm.webmaterial_atmosphere(planet_radius, atmosphere_radius);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static basic(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_basic(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @returns {string}
     */
    debugString() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webmaterial_debugString(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {WebMaterial}
     */
    static depth() {
        const ret = wasm.webmaterial_depth();
        return WebMaterial.__wrap(ret);
    }
    /**
     * MeshDistanceMaterial — used by point-light shadow depth passes.
     * `ref_x/y/z` is the reference position (typically the light's world pos).
     * @param {number} ref_x
     * @param {number} ref_y
     * @param {number} ref_z
     * @param {number} near
     * @param {number} far
     * @returns {WebMaterial}
     */
    static distance(ref_x, ref_y, ref_z, near, far) {
        const ret = wasm.webmaterial_distance(ref_x, ref_y, ref_z, near, far);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static lambert(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_lambert(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static line(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_line(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} scale
     * @param {number} dash_size
     * @param {number} gap_size
     * @returns {WebMaterial}
     */
    static lineDashed(color, scale, dash_size, gap_size) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_lineDashed(color.__wbg_ptr, scale, dash_size, gap_size);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static matcap(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_matcap(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * Mirror material — drives the Reflector / Refractor / Water shader path.
     * Color tints the reflection; `setMap` binds the render-target texture;
     * `setTextureMatrix` pushes the per-frame projective UV transform.
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @returns {WebMaterial}
     */
    static mirror(r, g, b) {
        const ret = wasm.webmaterial_mirror(r, g, b);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @returns {WebMaterial}
     */
    static normalMat() {
        const ret = wasm.webmaterial_normalMat();
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static phong(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_phong(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} roughness
     * @param {number} metalness
     * @param {number} clearcoat
     * @param {number} clearcoat_roughness
     * @returns {WebMaterial}
     */
    static physical(color, roughness, metalness, clearcoat, clearcoat_roughness) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_physical(color.__wbg_ptr, roughness, metalness, clearcoat, clearcoat_roughness);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} size
     * @returns {WebMaterial}
     */
    static points(color, size) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_points(color.__wbg_ptr, size);
        return WebMaterial.__wrap(ret);
    }
    /**
     * A measured-reflectance preset from `threers::materials::presets`.
     *
     * `param` is only read by the presets that take one: `anodized_titanium`
     * (film thickness, nm) and `brushed_aluminum` (streak rotation, radians).
     * An unknown name falls back to a neutral dielectric rather than throwing,
     * so a typo shows up as a visibly plain sphere instead of a dead page.
     * @param {string} name
     * @param {number} param
     * @returns {WebMaterial}
     */
    static preset(name, param) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webmaterial_preset(ptr0, len0, param);
        return WebMaterial.__wrap(ret);
    }
    /**
     * Airglow strength and colour on an `AtmosphereMaterial`.
     * @param {number} strength
     * @param {WebColor} color
     */
    setAirglow(strength, color) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setAirglow(this.__wbg_ptr, strength, color.__wbg_ptr);
    }
    /**
     * @param {number} value
     */
    setAlphaTest(value) {
        wasm.webmaterial_setAlphaTest(this.__wbg_ptr, value);
    }
    /**
     * three.js `anisotropy` / `anisotropyRotation` (radians).
     * @param {number} strength
     * @param {number} rotation
     */
    setAnisotropy(strength, rotation) {
        wasm.webmaterial_setAnisotropy(this.__wbg_ptr, strength, rotation);
    }
    /**
     * Tune the atmosphere: scattering tint, the colour it takes at the
     * terminator, overall strength, and how fast density falls with altitude.
     * @param {WebColor} sunset
     * @param {number} intensity
     * @param {number} falloff
     * @param {number} opacity
     */
    setAtmosphere(sunset, intensity, falloff, opacity) {
        _assertClass(sunset, WebColor);
        wasm.webmaterial_setAtmosphere(this.__wbg_ptr, sunset.__wbg_ptr, intensity, falloff, opacity);
    }
    /**
     * `[shell height, shadow strength, cloud longitude offset in turns,
     * twilight width]`.
     * @param {number} height
     * @param {number} shadow
     * @param {number} rotation
     * @param {number} twilight
     */
    setAtmosphereShading(height, shadow, rotation, twilight) {
        wasm.webmaterial_setAtmosphereShading(this.__wbg_ptr, height, shadow, rotation, twilight);
    }
    /**
     * three.js `attenuationColor` / `attenuationDistance`. A non-finite or
     * non-positive distance disables Beer-Lambert absorption.
     * @param {WebColor} color
     * @param {number} distance
     */
    setAttenuation(color, distance) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setAttenuation(this.__wbg_ptr, color.__wbg_ptr, distance);
    }
    /**
     * A cloud deck that casts shadows onto this surface.
     * @param {WebDataTexture} tex
     */
    setCloudShadowMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setCloudShadowMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * @param {WebColor} color
     */
    setColor(color) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setColor(this.__wbg_ptr, color.__wbg_ptr);
    }
    /**
     * @param {number} scale
     * @param {number} dash_size
     * @param {number} gap_size
     */
    setDashed(scale, dash_size, gap_size) {
        wasm.webmaterial_setDashed(this.__wbg_ptr, scale, dash_size, gap_size);
    }
    /**
     * three.js `material.displacementScale` / `displacementBias`.
     * @param {number} scale
     * @param {number} bias
     */
    setDisplacement(scale, bias) {
        wasm.webmaterial_setDisplacement(this.__wbg_ptr, scale, bias);
    }
    /**
     * Attach a height map (three.js `material.displacementMap`). Unlike a
     * normal map this moves vertices, so the mesh needs enough of them.
     * @param {WebTexture} tex
     */
    setDisplacementMap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setDisplacementMap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * `setDisplacementMap` for the raw `Uint8Array` / `DataTexture` path.
     * @param {WebDataTexture} tex
     */
    setDisplacementMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setDisplacementMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * A sphere that can eclipse the sun for this surface: world-space centre
     * and radius, plus the sun's angular radius in radians. A radius of 0
     * clears it.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} radius
     * @param {number} sun_angular_radius
     */
    setEclipse(x, y, z, radius, sun_angular_radius) {
        wasm.webmaterial_setEclipse(this.__wbg_ptr, x, y, z, radius, sun_angular_radius);
    }
    /**
     * Set the emissive color. Standard / Physical / Lambert / Phong / Toon
     * honor this; other variants are no-ops.
     * @param {WebColor} color
     */
    setEmissive(color) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setEmissive(this.__wbg_ptr, color.__wbg_ptr);
    }
    /**
     * Multiplier on the emissive contribution (`material.emissiveIntensity`).
     * @param {number} intensity
     */
    setEmissiveIntensity(intensity) {
        wasm.webmaterial_setEmissiveIntensity(this.__wbg_ptr, intensity);
    }
    /**
     * Attach an emissive map (three.js `material.emissiveMap`), multiplied by
     * `emissive` and `emissiveIntensity` — city lights on a night side, say.
     * @param {WebTexture} tex
     */
    setEmissiveMap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setEmissiveMap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * `setEmissiveMap` for the raw `Uint8Array` / `DataTexture` path.
     * @param {WebDataTexture} tex
     */
    setEmissiveMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setEmissiveMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * Confine the emissive map to the night side (0 = always on, 1 = terminator-gated).
     * City-lights maps need 1; lamps need 0.
     * @param {number} amount
     */
    setEmissiveNightSide(amount) {
        wasm.webmaterial_setEmissiveNightSide(this.__wbg_ptr, amount);
    }
    /**
     * three.js `iridescence` / `iridescenceIOR`, plus the film thickness in
     * nanometres (three.js expresses this as `iridescenceThicknessRange`; a
     * single thickness is used here since there is no thickness map).
     * @param {number} strength
     * @param {number} ior
     * @param {number} thickness_nm
     */
    setIridescence(strength, ior, thickness_nm) {
        wasm.webmaterial_setIridescence(this.__wbg_ptr, strength, ior, thickness_nm);
    }
    /**
     * Attach an albedo / color texture to this material. Mirrors three.js's
     * `material.map = texture`. Only Basic / Standard / Physical / Sprite
     * honor the slot; calling on other variants is a no-op.
     * @param {WebTexture} tex
     */
    setMap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setMap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * `setMapData` for textures created from raw `Uint8Array` data (three.js
     * `DataTexture` path). Same effect as `setMap` but typed for that handle.
     * @param {WebDataTexture} tex
     */
    setMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * @param {WebTexture} tex
     */
    setMatcap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setMatcap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * @param {WebDataTexture} tex
     */
    setMatcapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setMatcapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * three.js `material.metalness`.
     * @param {number} metalness
     */
    setMetalness(metalness) {
        wasm.webmaterial_setMetalness(this.__wbg_ptr, metalness);
    }
    /**
     * Attach a tangent-space normal map (three.js `material.normalMap`).
     * @param {WebTexture} tex
     */
    setNormalMap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setNormalMap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * `setNormalMap` for the raw `Uint8Array` / `DataTexture` path.
     * @param {WebDataTexture} tex
     */
    setNormalMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setNormalMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * three.js `material.normalScale`.
     * @param {number} x
     * @param {number} y
     */
    setNormalScale(x, y) {
        wasm.webmaterial_setNormalScale(this.__wbg_ptr, x, y);
    }
    /**
     * Set per-material opacity (0..1). Sets the matching field on whichever
     * concrete material this wraps.
     * @param {number} opacity
     */
    setOpacity(opacity) {
        wasm.webmaterial_setOpacity(this.__wbg_ptr, opacity);
    }
    /**
     * three.js `material.roughness`.
     * @param {number} roughness
     */
    setRoughness(roughness) {
        wasm.webmaterial_setRoughness(this.__wbg_ptr, roughness);
    }
    /**
     * @param {WebTexture} tex
     */
    setRoughnessMap(tex) {
        _assertClass(tex, WebTexture);
        wasm.webmaterial_setRoughnessMap(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * `setRoughnessMap` for the raw `Uint8Array` / `DataTexture` path.
     * @param {WebDataTexture} tex
     */
    setRoughnessMapData(tex) {
        _assertClass(tex, WebDataTexture);
        wasm.webmaterial_setRoughnessMapData(this.__wbg_ptr, tex.__wbg_ptr);
    }
    /**
     * three.js `sheen` / `sheenColor` / `sheenRoughness`.
     * @param {number} strength
     * @param {WebColor} color
     * @param {number} roughness
     */
    setSheen(strength, color, roughness) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setSheen(this.__wbg_ptr, strength, color.__wbg_ptr, roughness);
    }
    /**
     * Set the material's render side. `0` = FrontSide (default),
     * `1` = BackSide, `2` = DoubleSide. Both 1 and 2 route to the no-cull
     * triangle pipeline at draw time.
     * @param {number} side
     */
    setSide(side) {
        wasm.webmaterial_setSide(this.__wbg_ptr, side);
    }
    /**
     * Push a per-frame texture matrix (column-major 4×4) used by the mirror
     * fragment shader to projectively sample the RT. Computed JS-side as
     * `(0.5*bias+0.5) * virtualCam.projection * virtualCam.matrixWorldInverse`.
     * @param {Float32Array} elements
     */
    setTextureMatrix(elements) {
        const ptr0 = passArrayF32ToWasm0(elements, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webmaterial_setTextureMatrix(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * three.js `transmission` / `ior` / `thickness` / `dispersion`.
     * @param {number} transmission
     * @param {number} ior
     * @param {number} thickness
     * @param {number} dispersion
     */
    setTransmission(transmission, ior, thickness, dispersion) {
        wasm.webmaterial_setTransmission(this.__wbg_ptr, transmission, ior, thickness, dispersion);
    }
    /**
     * Transparency compositing mode: 0 = Blend, 1 = Glass, 2 = OIT,
     * 3 = Refract (screen-space refraction).
     * @param {number} mode
     */
    setTransparencyMode(mode) {
        wasm.webmaterial_setTransparencyMode(this.__wbg_ptr, mode);
    }
    /**
     * Mark a material as needing alpha blending. three.js uses an explicit
     * `transparent` flag separate from `opacity` so semi-transparent textures
     * can render correctly even at opacity 1.0.
     * @param {boolean} transparent
     */
    setTransparent(transparent) {
        wasm.webmaterial_setTransparent(this.__wbg_ptr, transparent);
    }
    /**
     * The colour scattered light takes on near the terminator.
     * @param {WebColor} color
     */
    setTwilightColor(color) {
        _assertClass(color, WebColor);
        wasm.webmaterial_setTwilightColor(this.__wbg_ptr, color.__wbg_ptr);
    }
    /**
     * Toggle wireframe rendering (renderer picks the line-polygon pipeline).
     * @param {boolean} wireframe
     */
    setWireframe(wireframe) {
        wasm.webmaterial_setWireframe(this.__wbg_ptr, wireframe);
    }
    /**
     * ShadowMaterial — black transparent surface that only shows shadow darkness.
     * @param {number} opacity
     * @returns {WebMaterial}
     */
    static shadow(opacity) {
        const ret = wasm.webmaterial_shadow(opacity);
        return WebMaterial.__wrap(ret);
    }
    /**
     * SkyMaterial — Preetham atmospheric scattering shader. Defaults match
     * three.js's `examples/jsm/objects/Sky.js`: turbidity 10, rayleigh 3,
     * mieCoefficient 0.005, mieDirectionalG 0.7.
     * @param {number} sun_x
     * @param {number} sun_y
     * @param {number} sun_z
     * @param {number} turbidity
     * @param {number} rayleigh
     * @param {number} mie_coefficient
     * @param {number} mie_directional_g
     * @returns {WebMaterial}
     */
    static sky(sun_x, sun_y, sun_z, turbidity, rayleigh, mie_coefficient, mie_directional_g) {
        const ret = wasm.webmaterial_sky(sun_x, sun_y, sun_z, turbidity, rayleigh, mie_coefficient, mie_directional_g);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static sprite(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_sprite(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @param {number} roughness
     * @param {number} metalness
     * @returns {WebMaterial}
     */
    static standard(color, roughness, metalness) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_standard(color.__wbg_ptr, roughness, metalness);
        return WebMaterial.__wrap(ret);
    }
    /**
     * @param {WebColor} color
     * @returns {WebMaterial}
     */
    static toon(color) {
        _assertClass(color, WebColor);
        const ret = wasm.webmaterial_toon(color.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
}
if (Symbol.dispose) WebMaterial.prototype[Symbol.dispose] = WebMaterial.prototype.free;

export class WebMathUtils {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMathUtilsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmathutils_free(ptr, 0);
    }
    /**
     * @param {number} v
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(v, min, max) {
        const ret = wasm.webmathutils_clamp(v, min, max);
        return ret;
    }
    /**
     * @param {number} d
     * @returns {number}
     */
    static degToRad(d) {
        const ret = wasm.webmathutils_degToRad(d);
        return ret;
    }
    /**
     * @param {number} n
     * @param {number} m
     * @returns {number}
     */
    static euclideanModulo(n, m) {
        const ret = wasm.webmathutils_euclideanModulo(n, m);
        return ret;
    }
    /**
     * @param {number} n
     * @returns {boolean}
     */
    static isPowerOfTwo(n) {
        const ret = wasm.webmathutils_isPowerOfTwo(n);
        return ret !== 0;
    }
    /**
     * @param {number} a
     * @param {number} b
     * @param {number} t
     * @returns {number}
     */
    static lerp(a, b, t) {
        const ret = wasm.webmathutils_lerp(a, b, t);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} a1
     * @param {number} a2
     * @param {number} b1
     * @param {number} b2
     * @returns {number}
     */
    static mapLinear(x, a1, a2, b1, b2) {
        const ret = wasm.webmathutils_mapLinear(x, a1, a2, b1, b2);
        return ret;
    }
    /**
     * @param {number} r
     * @returns {number}
     */
    static radToDeg(r) {
        const ret = wasm.webmathutils_radToDeg(r);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static smoothstep(x, min, max) {
        const ret = wasm.webmathutils_smoothstep(x, min, max);
        return ret;
    }
}
if (Symbol.dispose) WebMathUtils.prototype[Symbol.dispose] = WebMathUtils.prototype.free;

export class WebMatrix3 {
    static __wrap(ptr) {
        const obj = Object.create(WebMatrix3.prototype);
        obj.__wbg_ptr = ptr;
        WebMatrix3Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMatrix3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmatrix3_free(ptr, 0);
    }
    /**
     * @returns {Float32Array}
     */
    elements() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webmatrix3_elements(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {WebMatrix3}
     */
    static identity() {
        const ret = wasm.webmatrix3_identity();
        return WebMatrix3.__wrap(ret);
    }
    constructor() {
        const ret = wasm.webmatrix3_new();
        this.__wbg_ptr = ret;
        WebMatrix3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebMatrix3.prototype[Symbol.dispose] = WebMatrix3.prototype.free;

export class WebMatrix4 {
    static __wrap(ptr) {
        const obj = Object.create(WebMatrix4.prototype);
        obj.__wbg_ptr = ptr;
        WebMatrix4Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMatrix4Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmatrix4_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    determinant() {
        const ret = wasm.webmatrix4_determinant(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float32Array}
     */
    elements() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webmatrix4_elements(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {WebMatrix4}
     */
    static identity() {
        const ret = wasm.webmatrix4_identity();
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @returns {WebMatrix4}
     */
    invert() {
        const ret = wasm.webmatrix4_invert(this.__wbg_ptr);
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @param {WebVector3} eye
     * @param {WebVector3} target
     * @param {WebVector3} up
     * @returns {WebMatrix4}
     */
    static lookAt(eye, target, up) {
        _assertClass(eye, WebVector3);
        _assertClass(target, WebVector3);
        _assertClass(up, WebVector3);
        const ret = wasm.webmatrix4_lookAt(eye.__wbg_ptr, target.__wbg_ptr, up.__wbg_ptr);
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @param {number} fov
     * @param {number} aspect
     * @param {number} near
     * @param {number} far
     * @returns {WebMatrix4}
     */
    static makePerspective(fov, aspect, near, far) {
        const ret = wasm.webmatrix4_makePerspective(fov, aspect, near, far);
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {WebMatrix4}
     */
    static makeScale(x, y, z) {
        const ret = wasm.webmatrix4_makeScale(x, y, z);
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {WebMatrix4}
     */
    static makeTranslation(x, y, z) {
        const ret = wasm.webmatrix4_makeTranslation(x, y, z);
        return WebMatrix4.__wrap(ret);
    }
    /**
     * @param {WebMatrix4} m
     * @returns {WebMatrix4}
     */
    multiply(m) {
        _assertClass(m, WebMatrix4);
        const ret = wasm.webmatrix4_multiply(this.__wbg_ptr, m.__wbg_ptr);
        return WebMatrix4.__wrap(ret);
    }
    constructor() {
        const ret = wasm.webmatrix4_new();
        this.__wbg_ptr = ret;
        WebMatrix4Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebMatrix4.prototype[Symbol.dispose] = WebMatrix4.prototype.free;

export class WebMesh {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebMeshFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webmesh_free(ptr, 0);
    }
    /**
     * @param {WebGeometry} geom
     * @param {WebMaterial} mat
     */
    constructor(geom, mat) {
        _assertClass(geom, WebGeometry);
        _assertClass(mat, WebMaterial);
        const ret = wasm.webmesh_new(geom.__wbg_ptr, mat.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebMeshFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebMesh.prototype[Symbol.dispose] = WebMesh.prototype.free;

export class WebObjLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebObjLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webobjloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webobjloader_new();
        this.__wbg_ptr = ret;
        WebObjLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} src
     * @returns {WebGeometry}
     */
    parse(src) {
        const ptr0 = passStringToWasm0(src, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webobjloader_parse(this.__wbg_ptr, ptr0, len0);
        return WebGeometry.__wrap(ret);
    }
}
if (Symbol.dispose) WebObjLoader.prototype[Symbol.dispose] = WebObjLoader.prototype.free;

/**
 * Generic Object3D handle (Group or any scene-graph node).
 */
export class WebObject3D {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebObject3DFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webobject3d_free(ptr, 0);
    }
    /**
     * Empty group — three.js `new Group()` / `new Object3D()`.
     */
    constructor() {
        const ret = wasm.webobject3d_new();
        this.__wbg_ptr = ret;
        WebObject3DFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebObject3D.prototype[Symbol.dispose] = WebObject3D.prototype.free;

export class WebObjectHandle {
    static __wrap(ptr) {
        const obj = Object.create(WebObjectHandle.prototype);
        obj.__wbg_ptr = ptr;
        WebObjectHandleFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebObjectHandleFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webobjecthandle_free(ptr, 0);
    }
}
if (Symbol.dispose) WebObjectHandle.prototype[Symbol.dispose] = WebObjectHandle.prototype.free;

export class WebOctree {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebOctreeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_weboctree_free(ptr, 0);
    }
    /**
     * @param {WebVector3} p
     */
    insert(p) {
        _assertClass(p, WebVector3);
        wasm.weboctree_insert(this.__wbg_ptr, p.__wbg_ptr);
    }
    /**
     * @param {WebBox3} bb
     * @param {number} max_depth
     * @param {number} max_points
     */
    constructor(bb, max_depth, max_points) {
        _assertClass(bb, WebBox3);
        const ret = wasm.weboctree_new(bb.__wbg_ptr, max_depth, max_points);
        this.__wbg_ptr = ret;
        WebOctreeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebOctree.prototype[Symbol.dispose] = WebOctree.prototype.free;

export class WebOrbitControls {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebOrbitControlsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_weborbitcontrols_free(ptr, 0);
    }
    /**
     * @param {WebCamera} camera
     */
    constructor(camera) {
        _assertClass(camera, WebCamera);
        const ret = wasm.weborbitcontrols_new(camera.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebOrbitControlsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebCamera} camera
     */
    reseedFromCamera(camera) {
        _assertClass(camera, WebCamera);
        wasm.weborbitcontrols_reseedFromCamera(this.__wbg_ptr, camera.__wbg_ptr);
    }
    /**
     * @param {number} min_distance
     * @param {number} max_distance
     * @param {number} min_polar_angle
     * @param {number} max_polar_angle
     * @param {number} rotate_speed
     * @param {number} zoom_speed
     * @param {number} pan_speed
     * @param {number} damping
     */
    setLimits(min_distance, max_distance, min_polar_angle, max_polar_angle, rotate_speed, zoom_speed, pan_speed, damping) {
        wasm.weborbitcontrols_setLimits(this.__wbg_ptr, min_distance, max_distance, min_polar_angle, max_polar_angle, rotate_speed, zoom_speed, pan_speed, damping);
    }
    /**
     * Enable / tune inertia and auto-rotate (three.js parity).
     * @param {boolean} enable_damping
     * @param {number} damping
     * @param {boolean} auto_rotate
     * @param {number} auto_rotate_speed
     */
    setMotion(enable_damping, damping, auto_rotate, auto_rotate_speed) {
        wasm.weborbitcontrols_setMotion(this.__wbg_ptr, enable_damping, damping, auto_rotate, auto_rotate_speed);
    }
    /**
     * Orbit centre.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setTarget(x, y, z) {
        wasm.weborbitcontrols_setTarget(this.__wbg_ptr, x, y, z);
    }
    /**
     * @param {WebCamera} camera
     * @param {number} dx
     * @param {number} dy
     * @param {number} wheel
     * @param {boolean} rotating
     * @param {boolean} panning
     * @param {number} w
     * @param {number} h
     */
    update(camera, dx, dy, wheel, rotating, panning, w, h) {
        _assertClass(camera, WebCamera);
        wasm.weborbitcontrols_update(this.__wbg_ptr, camera.__wbg_ptr, dx, dy, wheel, rotating, panning, w, h);
    }
    /**
     * @param {WebCamera} camera
     * @param {number} dx
     * @param {number} dy
     * @param {number} wheel
     * @param {boolean} rotating
     * @param {boolean} panning
     * @param {number} w
     * @param {number} h
     * @param {number} dt
     */
    updateDt(camera, dx, dy, wheel, rotating, panning, w, h, dt) {
        _assertClass(camera, WebCamera);
        wasm.weborbitcontrols_updateDt(this.__wbg_ptr, camera.__wbg_ptr, dx, dy, wheel, rotating, panning, w, h, dt);
    }
}
if (Symbol.dispose) WebOrbitControls.prototype[Symbol.dispose] = WebOrbitControls.prototype.free;

export class WebPath {
    static __wrap(ptr) {
        const obj = Object.create(WebPath.prototype);
        obj.__wbg_ptr = ptr;
        WebPathFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPathFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webpath_free(ptr, 0);
    }
    /**
     * @param {number} cx
     * @param {number} cy
     * @param {number} radius
     * @param {number} start
     * @param {number} end
     * @param {boolean} clockwise
     */
    arc(cx, cy, radius, start, end, clockwise) {
        wasm.webpath_arc(this.__wbg_ptr, cx, cy, radius, start, end, clockwise);
    }
    /**
     * @param {number} c1x
     * @param {number} c1y
     * @param {number} c2x
     * @param {number} c2y
     * @param {number} x
     * @param {number} y
     */
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        wasm.webpath_bezierCurveTo(this.__wbg_ptr, c1x, c1y, c2x, c2y, x, y);
    }
    /**
     * Read an SVG `d` string — the inbound half, for turning artwork into
     * geometry.
     * @param {string} d
     * @returns {WebPath}
     */
    static fromSvgPathData(d) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(d, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webpath_fromSvgPathData(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebPath.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Sample the path as a flat polyline — `divisions` points per sub-curve.
     * @param {number} divisions
     * @returns {Float32Array}
     */
    getPoints(divisions) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webpath_getPoints(retptr, this.__wbg_ptr, divisions);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    lineTo(x, y) {
        wasm.webpath_lineTo(this.__wbg_ptr, x, y);
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    moveTo(x, y) {
        wasm.webpath_moveTo(this.__wbg_ptr, x, y);
    }
    constructor() {
        const ret = wasm.webpath_new();
        this.__wbg_ptr = ret;
        WebPathFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} cpx
     * @param {number} cpy
     * @param {number} x
     * @param {number} y
     */
    quadraticCurveTo(cpx, cpy, x, y) {
        wasm.webpath_quadraticCurveTo(this.__wbg_ptr, cpx, cpy, x, y);
    }
    /**
     * The path as an SVG `d` string, with its curves intact rather than
     * flattened. Note that SVG's y axis points down and these coordinates are
     * y-up, so a document usually wants a `scale(1,-1)` around them.
     * @param {number} precision
     * @returns {string}
     */
    toSvgPathData(precision) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webpath_toSvgPathData(retptr, this.__wbg_ptr, precision);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) WebPath.prototype[Symbol.dispose] = WebPath.prototype.free;

export class WebPlane {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPlaneFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webplane_free(ptr, 0);
    }
    /**
     * @param {WebVector3} p
     * @returns {number}
     */
    distanceToPoint(p) {
        _assertClass(p, WebVector3);
        const ret = wasm.webplane_distanceToPoint(this.__wbg_ptr, p.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WebVector3} normal
     * @param {number} constant
     */
    constructor(normal, constant) {
        _assertClass(normal, WebVector3);
        const ret = wasm.webplane_new(normal.__wbg_ptr, constant);
        this.__wbg_ptr = ret;
        WebPlaneFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebPlane.prototype[Symbol.dispose] = WebPlane.prototype.free;

export class WebPlyLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPlyLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webplyloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webplyloader_new();
        this.__wbg_ptr = ret;
        WebPlyLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WebGeometry}
     */
    parse(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webplyloader_parse(this.__wbg_ptr, ptr0, len0);
        return WebGeometry.__wrap(ret);
    }
}
if (Symbol.dispose) WebPlyLoader.prototype[Symbol.dispose] = WebPlyLoader.prototype.free;

export class WebPmremGenerator {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPmremGeneratorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webpmremgenerator_free(ptr, 0);
    }
    /**
     * Prefilter `cube` into a PMREM mip chain at `size` and return a CubeTexture wrapper.
     * @param {WebCubeTexture} cube
     * @param {number} size
     * @returns {WebCubeTexture}
     */
    static fromCubemap(cube, size) {
        _assertClass(cube, WebCubeTexture);
        const ret = wasm.webpmremgenerator_fromCubemap(cube.__wbg_ptr, size);
        return WebCubeTexture.__wrap(ret);
    }
    /**
     * Convert an equirectangular RGBA8 texture into a PMREM cubemap.
     * @param {Uint8Array} data
     * @param {number} src_w
     * @param {number} src_h
     * @param {number} cube_size
     * @returns {WebCubeTexture}
     */
    static fromEquirectangular(data, src_w, src_h, cube_size) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webpmremgenerator_fromEquirectangular(ptr0, len0, src_w, src_h, cube_size);
        return WebCubeTexture.__wrap(ret);
    }
    constructor() {
        const ret = wasm.webpmremgenerator_new();
        this.__wbg_ptr = ret;
        WebPmremGeneratorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebPmremGenerator.prototype[Symbol.dispose] = WebPmremGenerator.prototype.free;

export class WebPointerLockControls {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPointerLockControlsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webpointerlockcontrols_free(ptr, 0);
    }
    /**
     * @param {WebCamera} camera
     */
    constructor(camera) {
        _assertClass(camera, WebCamera);
        const ret = wasm.webpointerlockcontrols_new(camera.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebPointerLockControlsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebPointerLockControls.prototype[Symbol.dispose] = WebPointerLockControls.prototype.free;

export class WebPolarGridHelper {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebPolarGridHelperFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webpolargridhelper_free(ptr, 0);
    }
    /**
     * @param {number} radius
     * @param {number} segments
     * @param {number} circles
     */
    constructor(radius, segments, circles) {
        const ret = wasm.webpolargridhelper_new(radius, segments, circles);
        this.__wbg_ptr = ret;
        WebPolarGridHelperFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebPolarGridHelper.prototype[Symbol.dispose] = WebPolarGridHelper.prototype.free;

export class WebQuaternion {
    static __wrap(ptr) {
        const obj = Object.create(WebQuaternion.prototype);
        obj.__wbg_ptr = ptr;
        WebQuaternionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebQuaternionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webquaternion_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get w() {
        const ret = wasm.__wbg_get_webquaternion_w(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_webquaternion_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_webquaternion_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_webquaternion_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set w(arg0) {
        wasm.__wbg_set_webquaternion_w(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_webquaternion_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_webquaternion_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_webquaternion_z(this.__wbg_ptr, arg0);
    }
    /**
     * @param {WebQuaternion} o
     * @returns {number}
     */
    dot(o) {
        _assertClass(o, WebQuaternion);
        const ret = wasm.webquaternion_dot(this.__wbg_ptr, o.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {WebQuaternion}
     */
    static identity() {
        const ret = wasm.webquaternion_identity();
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @returns {WebQuaternion}
     */
    invert() {
        const ret = wasm.webquaternion_invert(this.__wbg_ptr);
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @param {WebQuaternion} o
     * @returns {WebQuaternion}
     */
    multiply(o) {
        _assertClass(o, WebQuaternion);
        const ret = wasm.webquaternion_multiply(this.__wbg_ptr, o.__wbg_ptr);
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    constructor(x, y, z, w) {
        const ret = wasm.webquaternion_new(x, y, z, w);
        this.__wbg_ptr = ret;
        WebQuaternionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {WebQuaternion}
     */
    normalize() {
        const ret = wasm.webquaternion_normalize(this.__wbg_ptr);
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @param {WebVector3} axis
     * @param {number} angle
     * @returns {WebQuaternion}
     */
    setFromAxisAngle(axis, angle) {
        _assertClass(axis, WebVector3);
        const ret = wasm.webquaternion_setFromAxisAngle(this.__wbg_ptr, axis.__wbg_ptr, angle);
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @param {WebEuler} e
     * @returns {WebQuaternion}
     */
    static setFromEuler(e) {
        _assertClass(e, WebEuler);
        const ret = wasm.webquaternion_setFromEuler(e.__wbg_ptr);
        return WebQuaternion.__wrap(ret);
    }
    /**
     * @param {WebQuaternion} o
     * @param {number} t
     * @returns {WebQuaternion}
     */
    slerp(o, t) {
        _assertClass(o, WebQuaternion);
        const ret = wasm.webquaternion_slerp(this.__wbg_ptr, o.__wbg_ptr, t);
        return WebQuaternion.__wrap(ret);
    }
}
if (Symbol.dispose) WebQuaternion.prototype[Symbol.dispose] = WebQuaternion.prototype.free;

export class WebRay {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebRayFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webray_free(ptr, 0);
    }
    /**
     * @param {number} t
     * @returns {WebVector3}
     */
    at(t) {
        const ret = wasm.webray_at(this.__wbg_ptr, t);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebVector3} origin
     * @param {WebVector3} direction
     */
    constructor(origin, direction) {
        _assertClass(origin, WebVector3);
        _assertClass(direction, WebVector3);
        const ret = wasm.webray_new(origin.__wbg_ptr, direction.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebRayFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebRay.prototype[Symbol.dispose] = WebRay.prototype.free;

export class WebRaycaster {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebRaycasterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webraycaster_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webraycaster_new();
        this.__wbg_ptr = ret;
        WebRaycasterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} ndc_x
     * @param {number} ndc_y
     * @param {WebCamera} camera
     */
    setFromCamera(ndc_x, ndc_y, camera) {
        _assertClass(camera, WebCamera);
        wasm.webraycaster_setFromCamera(this.__wbg_ptr, ndc_x, ndc_y, camera.__wbg_ptr);
    }
}
if (Symbol.dispose) WebRaycaster.prototype[Symbol.dispose] = WebRaycaster.prototype.free;

export class WebRenderPass {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebRenderPassFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webrenderpass_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webrenderpass_new();
        this.__wbg_ptr = ret;
        WebRenderPassFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebRenderPass.prototype[Symbol.dispose] = WebRenderPass.prototype.free;

export class WebRenderTarget {
    static __wrap(ptr) {
        const obj = Object.create(WebRenderTarget.prototype);
        obj.__wbg_ptr = ptr;
        WebRenderTargetFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebRenderTargetFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webrendertarget_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_webrendertarget_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get id() {
        const ret = wasm.__wbg_get_webrendertarget_id(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_webrendertarget_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_webrendertarget_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set id(arg0) {
        wasm.__wbg_set_webrendertarget_id(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_webrendertarget_width(this.__wbg_ptr, arg0);
    }
    /**
     * @param {WebRenderer} renderer
     * @param {number} width
     * @param {number} height
     */
    constructor(renderer, width, height) {
        _assertClass(renderer, WebRenderer);
        const ret = wasm.webrendertarget_new(renderer.__wbg_ptr, width, height);
        this.__wbg_ptr = ret;
        WebRenderTargetFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Half-float color RT for outline intermediates (matches three.js OutlinePass).
     * @param {WebRenderer} renderer
     * @param {number} width
     * @param {number} height
     * @returns {WebRenderTarget}
     */
    static newHalfFloat(renderer, width, height) {
        _assertClass(renderer, WebRenderer);
        const ret = wasm.webrendertarget_newHalfFloat(renderer.__wbg_ptr, width, height);
        return WebRenderTarget.__wrap(ret);
    }
    /**
     * @param {number} _w
     * @param {number} _h
     */
    setSize(_w, _h) {
        wasm.webrendertarget_setSize(this.__wbg_ptr, _w, _h);
    }
}
if (Symbol.dispose) WebRenderTarget.prototype[Symbol.dispose] = WebRenderTarget.prototype.free;

/**
 * Top-level WebGPU renderer bound to a canvas element. The constructor is
 * async because adapter/device acquisition is async on the web.
 */
export class WebRenderer {
    static __wrap(ptr) {
        const obj = Object.create(WebRenderer.prototype);
        obj.__wbg_ptr = ptr;
        WebRendererFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webrenderer_free(ptr, 0);
    }
    /**
     * Apply a post-fx pass: read input render target, write to canvas.
     * `kind`: 0=copy … 11=ssao, 12=ssr, 13=ssao-blur, 14=ssao-composite.
     * `depth_rt_id` / `normal_rt_id`: optional prepass RTs (0 = fallback).
     * For SSAO (kind 11), pass camera near/far, kernel size, and projection
     * matrices via the trailing arguments.
     * @param {number} input_rt_id
     * @param {number} depth_rt_id
     * @param {number} normal_rt_id
     * @param {number} kind
     * @param {number} time
     * @param {number} p2x
     * @param {number} p2y
     * @param {number} p2z
     * @param {number} p2w
     * @param {number} p3x
     * @param {number} p3y
     * @param {number} p3z
     * @param {number} p3w
     * @param {number} additive
     * @param {number} cam_near
     * @param {number} cam_far
     * @param {number} kernel_radius
     * @param {number} kernel_size
     * @param {Float32Array} proj
     * @param {Float32Array} inv_proj
     */
    applyPostFx(input_rt_id, depth_rt_id, normal_rt_id, kind, time, p2x, p2y, p2z, p2w, p3x, p3y, p3z, p3w, additive, cam_near, cam_far, kernel_radius, kernel_size, proj, inv_proj) {
        const ptr0 = passArrayF32ToWasm0(proj, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(inv_proj, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.webrenderer_applyPostFx(this.__wbg_ptr, input_rt_id, depth_rt_id, normal_rt_id, kind, time, p2x, p2y, p2z, p2w, p3x, p3y, p3z, p3w, additive, cam_near, cam_far, kernel_radius, kernel_size, ptr0, len0, ptr1, len1);
    }
    /**
     * Apply a post-fx pass writing into a render target (not canvas).
     * @param {number} input_rt_id
     * @param {number} output_rt_id
     * @param {number} depth_rt_id
     * @param {number} normal_rt_id
     * @param {number} kind
     * @param {number} time
     * @param {number} p2x
     * @param {number} p2y
     * @param {number} p2z
     * @param {number} p2w
     * @param {number} p3x
     * @param {number} p3y
     * @param {number} p3z
     * @param {number} p3w
     * @param {number} cam_near
     * @param {number} cam_far
     * @param {number} kernel_radius
     * @param {number} kernel_size
     * @param {Float32Array} proj
     * @param {Float32Array} inv_proj
     */
    applyPostFxToRT(input_rt_id, output_rt_id, depth_rt_id, normal_rt_id, kind, time, p2x, p2y, p2z, p2w, p3x, p3y, p3z, p3w, cam_near, cam_far, kernel_radius, kernel_size, proj, inv_proj) {
        const ptr0 = passArrayF32ToWasm0(proj, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(inv_proj, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.webrenderer_applyPostFxToRT(this.__wbg_ptr, input_rt_id, output_rt_id, depth_rt_id, normal_rt_id, kind, time, p2x, p2y, p2z, p2w, p3x, p3y, p3z, p3w, cam_near, cam_far, kernel_radius, kernel_size, ptr0, len0, ptr1, len1);
    }
    /**
     * Which backend this renderer got: `"webgpu"`, `"gl"`, or the backend's
     * own name on other targets.
     *
     * Worth asking. On `"gl"` — WebGL2 — there is no compute stage, so bloom,
     * ambient occlusion and the packed post chain switch themselves off. They
     * do it quietly, because the alternative is refusing to draw at all, and
     * without this there is no way to tell that from a scene that simply has
     * no bloom in it.
     * @returns {string}
     */
    backend() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webrenderer_backend(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Present tightly-packed RGBA8 bytes (top-first rows) to the canvas surface.
     * @param {Uint8Array} data
     * @param {number} width
     * @param {number} height
     */
    blitRgba8ToCanvas(data, width, height) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_blitRgba8ToCanvas(this.__wbg_ptr, ptr0, len0, width, height);
    }
    /**
     * How many geometries currently have GPU buffers. Drops when a removed
     * mesh's geometry is gone (see `Renderer::evict_dead_geometry`).
     * @returns {number}
     */
    cachedGeometryCount() {
        const ret = wasm.webrenderer_cachedGeometryCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Async factory. Pass an HTMLCanvasElement, or an OffscreenCanvas (from
     * `canvas.transferControlToOffscreen()`, to render from a worker), and the
     * renderer attaches to it.
     * @param {any} canvas
     * @returns {Promise<WebRenderer>}
     */
    static new(canvas) {
        const ret = wasm.webrenderer_new(addHeapObject(canvas));
        return takeObject(ret);
    }
    /**
     * Async readback of a half-float render target (raw RGBA16F bytes).
     * @param {number} target_id
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @returns {Promise<any>}
     */
    readRenderTargetF16(target_id, x, y, w, h) {
        const ret = wasm.webrenderer_readRenderTargetF16(this.__wbg_ptr, target_id, x, y, w, h);
        return takeObject(ret);
    }
    /**
     * Read pixels from a render target. Returns a Promise<Uint8Array> of RGBA
     * bytes in row-major order (4 bytes per pixel). The copy is encoded into
     * a staging buffer; the buffer is mapped asynchronously and the bytes
     * returned to JS once the GPU has finished.
     * @param {number} target_id
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @returns {Promise<any>}
     */
    readRenderTargetPixels(target_id, x, y, w, h) {
        const ret = wasm.webrenderer_readRenderTargetPixels(this.__wbg_ptr, target_id, x, y, w, h);
        return takeObject(ret);
    }
    /**
     * @param {WebScene} scene
     * @param {WebCamera} camera
     */
    render(scene, camera) {
        _assertClass(scene, WebScene);
        _assertClass(camera, WebCamera);
        wasm.webrenderer_render(this.__wbg_ptr, scene.__wbg_ptr, camera.__wbg_ptr);
    }
    /**
     * Build a Texture that samples from the given render target's color view.
     * Used to chain post-processing passes: render scene into RT, then use
     * that RT as a material map on a fullscreen quad mesh.
     * @param {WebRenderTarget} rt
     * @returns {WebTexture}
     */
    renderTargetTexture(rt) {
        _assertClass(rt, WebRenderTarget);
        const ret = wasm.webrenderer_renderTargetTexture(this.__wbg_ptr, rt.__wbg_ptr);
        return WebTexture.__wrap(ret);
    }
    /**
     * Render one face of a cube render target. CubeCamera.update() calls
     * this six times with face indices 0..6 and the matching face camera.
     * @param {WebScene} scene
     * @param {WebCamera} camera
     * @param {WebCubeRenderTarget} target
     * @param {number} face
     */
    renderToCubeFace(scene, camera, target, face) {
        _assertClass(scene, WebScene);
        _assertClass(camera, WebCamera);
        _assertClass(target, WebCubeRenderTarget);
        wasm.webrenderer_renderToCubeFace(this.__wbg_ptr, scene.__wbg_ptr, camera.__wbg_ptr, target.__wbg_ptr, face);
    }
    /**
     * @param {Float32Array} data
     * @param {number} width
     * @param {number} height
     */
    setDotscreenPattern(data, width, height) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_setDotscreenPattern(this.__wbg_ptr, ptr0, len0, width, height);
    }
    /**
     * @param {Float32Array} data
     * @param {number} size
     */
    setGlitchDisp(data, size) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_setGlitchDisp(this.__wbg_ptr, ptr0, len0, size);
    }
    /**
     * @param {Float32Array} data
     * @param {number} width
     * @param {number} height
     */
    setGlitchSnow(data, width, height) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_setGlitchSnow(this.__wbg_ptr, ptr0, len0, width, height);
    }
    /**
     * @param {number} samples
     */
    setMsaa(samples) {
        wasm.webrenderer_setMsaa(this.__wbg_ptr, samples);
    }
    /**
     * Set the active render target by id. When non-zero, `render()` draws
     * into the target's offscreen texture; pass 0 to restore canvas rendering.
     * We pass the id (not the WebRenderTarget instance) so the JS-side
     * wrapper isn't moved into Rust ownership and remains usable for
     * subsequent calls like `readRenderTargetPixels`.
     * @param {number} target_id
     */
    setRenderTarget(target_id) {
        wasm.webrenderer_setRenderTarget(this.__wbg_ptr, target_id);
    }
    /**
     * @param {number} w
     * @param {number} h
     */
    setSize(w, h) {
        wasm.webrenderer_setSize(this.__wbg_ptr, w, h);
    }
    /**
     * Upload SSAO hemisphere kernel (96 floats: 32×vec3, padded to vec4 on GPU).
     * @param {Float32Array} kernel
     */
    setSsaoKernel(kernel) {
        const ptr0 = passArrayF32ToWasm0(kernel, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_setSsaoKernel(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Upload 4×4 SSAO rotation noise (16 floats, R32Float texture).
     * @param {Float32Array} noise
     */
    setSsaoNoise(noise) {
        const ptr0 = passArrayF32ToWasm0(noise, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webrenderer_setSsaoNoise(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Enable hardware MSAA on the direct-to-canvas pass. `samples <= 1` = off,
     * else 4×. Only the opaque forward pass is multisampled — render targets,
     * shadows, and glass/OIT/refraction scenes stay single-sampled.
     * three.js `renderer.toneMapping` / `renderer.toneMappingExposure`.
     *
     * Takes three.js's numeric constants: `0` NoToneMapping, `1` Linear,
     * `4` ACESFilmic. Anything else falls back to linear, which is closer to
     * the intent than clipping.
     * @param {number} mode
     * @param {number} exposure
     */
    setToneMapping(mode, exposure) {
        wasm.webrenderer_setToneMapping(this.__wbg_ptr, mode, exposure);
    }
    /**
     * Whether this device can run compute passes.
     *
     * False on WebGL2, and the reason the compute-backed effects are
     * unavailable there.
     * @returns {boolean}
     */
    supportsCompute() {
        const ret = wasm.webrenderer_supportsCompute(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) WebRenderer.prototype[Symbol.dispose] = WebRenderer.prototype.free;

/**
 * JS-visible scene wrapper. Returns a `Mesh` handle from `add(mesh)` so JS
 * can keep a reference for subsequent transform updates.
 */
export class WebScene {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebSceneFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webscene_free(ptr, 0);
    }
    /**
     * Add a mesh to the scene. Returns its `ObjectId` (wrapped as `WebObjectHandle`).
     * @param {WebMesh} mesh
     * @returns {WebObjectHandle}
     */
    add(mesh) {
        _assertClass(mesh, WebMesh);
        const ret = wasm.webscene_add(this.__wbg_ptr, mesh.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add an empty Group node (Object3D with no kind). Returns its handle so
     * children can be parented under it via `addMeshTo` / `addGroupTo`.
     * @returns {WebObjectHandle}
     */
    addGroup() {
        const ret = wasm.webscene_addGroup(this.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a helper as a scene-graph child (returns its handle for later removal).
     * @param {WebAxesHelper | null} [axes]
     * @param {WebGridHelper | null} [grid]
     * @returns {WebObjectHandle}
     */
    addHelper(axes, grid) {
        let ptr0 = 0;
        if (!isLikeNone(axes)) {
            _assertClass(axes, WebAxesHelper);
            ptr0 = axes.__destroy_into_raw();
        }
        let ptr1 = 0;
        if (!isLikeNone(grid)) {
            _assertClass(grid, WebGridHelper);
            ptr1 = grid.__destroy_into_raw();
        }
        const ret = wasm.webscene_addHelper(this.__wbg_ptr, ptr0, ptr1);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add an InstancedMesh — a geometry rendered N times with per-instance
     * transforms, each entry is a column-major mat4 packed as 16 f32s.
     * @param {WebGeometry} geom
     * @param {WebMaterial} mat
     * @param {Float32Array} transforms
     * @returns {WebObjectHandle}
     */
    addInstancedMesh(geom, mat, transforms) {
        _assertClass(geom, WebGeometry);
        _assertClass(mat, WebMaterial);
        const ptr0 = passArrayF32ToWasm0(transforms, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webscene_addInstancedMesh(this.__wbg_ptr, geom.__wbg_ptr, mat.__wbg_ptr, ptr0, len0);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a light source.
     * @param {WebLight} light
     * @returns {WebObjectHandle}
     */
    addLight(light) {
        _assertClass(light, WebLight);
        const ret = wasm.webscene_addLight(this.__wbg_ptr, light.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a LineSegments primitive (geometry interpreted as line-list).
     * @param {WebBufferGeometry} geom
     * @param {WebMaterial} mat
     * @returns {WebObjectHandle}
     */
    addLineSegments(geom, mat) {
        _assertClass(geom, WebBufferGeometry);
        _assertClass(mat, WebMaterial);
        const ret = wasm.webscene_addLineSegments(this.__wbg_ptr, geom.__wbg_ptr, mat.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a mesh under the given parent (a Group's handle). Returns the
     * mesh's own handle for further transform updates.
     * @param {WebObjectHandle} parent
     * @param {WebMesh} mesh
     * @returns {WebObjectHandle}
     */
    addMeshTo(parent, mesh) {
        _assertClass(parent, WebObjectHandle);
        _assertClass(mesh, WebMesh);
        const ret = wasm.webscene_addMeshTo(this.__wbg_ptr, parent.__wbg_ptr, mesh.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a generic Object3D (group, helper, etc.) to the scene.
     * @param {WebObject3D} obj
     * @returns {WebObjectHandle}
     */
    addObject(obj) {
        _assertClass(obj, WebObject3D);
        const ret = wasm.webscene_addObject(this.__wbg_ptr, obj.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a Points primitive (geometry interpreted as point-list).
     * @param {WebBufferGeometry} geom
     * @param {WebMaterial} mat
     * @returns {WebObjectHandle}
     */
    addPoints(geom, mat) {
        _assertClass(geom, WebBufferGeometry);
        _assertClass(mat, WebMaterial);
        const ret = wasm.webscene_addPoints(this.__wbg_ptr, geom.__wbg_ptr, mat.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a SkinnedMesh. We default the skeleton to `bone_count` identity
     * transforms — the mesh renders as a regular Mesh until bone matrices
     * get updated (a hook can be added later to drive bones each frame).
     * @param {WebGeometry} geom
     * @param {WebMaterial} mat
     * @param {number} bone_count
     * @returns {WebObjectHandle}
     */
    addSkinnedMesh(geom, mat, bone_count) {
        _assertClass(geom, WebGeometry);
        _assertClass(mat, WebMaterial);
        const ret = wasm.webscene_addSkinnedMesh(this.__wbg_ptr, geom.__wbg_ptr, mat.__wbg_ptr, bone_count);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Add a Sprite (billboard) at the scene root. The renderer expands the
     * material into a camera-facing quad on the fly.
     * @param {WebMaterial} mat
     * @returns {WebObjectHandle}
     */
    addSprite(mat) {
        _assertClass(mat, WebMaterial);
        const ret = wasm.webscene_addSprite(this.__wbg_ptr, mat.__wbg_ptr);
        return WebObjectHandle.__wrap(ret);
    }
    /**
     * Diagnostic — for each light in the scene, print its world position and
     * (for spot/directional) direction, after update_world is called.
     * @returns {string}
     */
    dumpLights() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webscene_dumpLights(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Find the first object whose name matches.
     * @param {string} name
     * @returns {WebObjectHandle | undefined}
     */
    getObjectByName(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webscene_getObjectByName(this.__wbg_ptr, ptr0, len0);
        return ret === 0 ? undefined : WebObjectHandle.__wrap(ret);
    }
    /**
     * Get the world-space position (after parent transforms).
     * @param {WebObjectHandle} handle
     * @returns {WebVector3}
     */
    getWorldPosition(handle) {
        _assertClass(handle, WebObjectHandle);
        const ret = wasm.webscene_getWorldPosition(this.__wbg_ptr, handle.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * Diagnostic — count lights of each kind currently in this scene.
     * @returns {string}
     */
    lightCounts() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webscene_lightCounts(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Query whether a LineSegments object's geometry has a named attribute.
     * @param {WebObjectHandle} handle
     * @param {string} name
     * @returns {boolean}
     */
    lineGeometryHasAttr(handle, name) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webscene_lineGeometryHasAttr(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
        return ret !== 0;
    }
    /**
     * @param {WebObjectHandle} handle
     * @param {number} vert
     * @returns {number}
     */
    lineGeometryUvX(handle, vert) {
        _assertClass(handle, WebObjectHandle);
        const ret = wasm.webscene_lineGeometryUvX(this.__wbg_ptr, handle.__wbg_ptr, vert);
        return ret;
    }
    /**
     * @param {WebObjectHandle} handle
     * @returns {number}
     */
    lineMaterialDashSize(handle) {
        _assertClass(handle, WebObjectHandle);
        const ret = wasm.webscene_lineMaterialDashSize(this.__wbg_ptr, handle.__wbg_ptr);
        return ret;
    }
    /**
     * Look-at: orient the object so its -Z axis points at target.
     * @param {WebObjectHandle} handle
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    lookAt(handle, x, y, z) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_lookAt(this.__wbg_ptr, handle.__wbg_ptr, x, y, z);
    }
    constructor() {
        const ret = wasm.webscene_new();
        this.__wbg_ptr = ret;
        WebSceneFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * How many objects the scene arena holds (root included).
     * @returns {number}
     */
    objectCount() {
        const ret = wasm.webscene_objectCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Remove an object from the scene (by handle).
     * @param {WebObjectHandle} handle
     */
    remove(handle) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_remove(this.__wbg_ptr, handle.__wbg_ptr);
    }
    /**
     * Clear alpha for the framebuffer (0 = transparent canvas over HTML video).
     * @param {number} alpha
     */
    setBackgroundAlpha(alpha) {
        wasm.webscene_setBackgroundAlpha(this.__wbg_ptr, alpha);
    }
    /**
     * Update a skinned mesh's bone matrices. Each matrix is 16 floats
     * (column-major); the caller passes the matrices concatenated.
     * Re-uploaded to the storage buffer on the next render.
     * @param {WebObjectHandle} handle
     * @param {Float32Array} matrices
     */
    setBoneMatrices(handle, matrices) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passArrayF32ToWasm0(matrices, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setBoneMatrices(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * Bind a cube render target as this scene's environment map. Pass `0`
     * to clear and fall back to the CPU-side `environment` cubemap.
     * @param {number} rt_id
     */
    setEnvironmentCube(rt_id) {
        wasm.webscene_setEnvironmentCube(this.__wbg_ptr, rt_id);
    }
    /**
     * Bind a CPU-side cubemap (optionally PMREM-filtered) as the environment.
     * @param {WebCubeTexture} cube
     */
    setEnvironmentMap(cube) {
        _assertClass(cube, WebCubeTexture);
        wasm.webscene_setEnvironmentMap(this.__wbg_ptr, cube.__wbg_ptr);
    }
    /**
     * Configure fog. `mode`: 0 = off, 1 = linear, 2 = exp2. `near`/`far` are
     * used for linear; `density` is used for exp2.
     * @param {WebColor} color
     * @param {number} near
     * @param {number} far
     * @param {number} density
     * @param {number} mode
     */
    setFog(color, near, far, density, mode) {
        _assertClass(color, WebColor);
        wasm.webscene_setFog(this.__wbg_ptr, color.__wbg_ptr, near, far, density, mode);
    }
    /**
     * Point a scene mesh at the current `WebMaterial` Arc (after `setColor` etc.).
     * @param {WebObjectHandle} handle
     * @param {WebMaterial} mat
     */
    setMeshMaterial(handle, mat) {
        _assertClass(handle, WebObjectHandle);
        _assertClass(mat, WebMaterial);
        wasm.webscene_setMeshMaterial(this.__wbg_ptr, handle.__wbg_ptr, mat.__wbg_ptr);
    }
    /**
     * Replace a mesh's geometry normals in place.
     * @param {WebObjectHandle} handle
     * @param {Float32Array} normals
     */
    setMeshNormals(handle, normals) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passArrayF32ToWasm0(normals, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setMeshNormals(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * Replace a mesh's geometry positions in place. Used for morph-target
     * vertex blending and any dynamic vertex animation.
     * @param {WebObjectHandle} handle
     * @param {Float32Array} positions
     */
    setMeshPositions(handle, positions) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setMeshPositions(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * Set a name on the object identified by `handle`.
     * @param {WebObjectHandle} handle
     * @param {string} name
     */
    setName(handle, name) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setName(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * three.js `Object3D.castShadow`.
     * @param {WebObjectHandle} handle
     * @param {boolean} cast
     */
    setObjectCastShadow(handle, cast) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_setObjectCastShadow(this.__wbg_ptr, handle.__wbg_ptr, cast);
    }
    /**
     * three.js `Object3D.receiveShadow`.
     * @param {WebObjectHandle} handle
     * @param {boolean} receive
     */
    setObjectReceiveShadow(handle, receive) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_setObjectReceiveShadow(this.__wbg_ptr, handle.__wbg_ptr, receive);
    }
    /**
     * three.js Object3D.renderOrder — lower draws first within transparency class.
     * @param {WebObjectHandle} handle
     * @param {number} order
     */
    setRenderOrder(handle, order) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_setRenderOrder(this.__wbg_ptr, handle.__wbg_ptr, order);
    }
    /**
     * Set scale.
     * @param {WebObjectHandle} handle
     * @param {number} sx
     * @param {number} sy
     * @param {number} sz
     */
    setScale(handle, sx, sy, sz) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_setScale(this.__wbg_ptr, handle.__wbg_ptr, sx, sy, sz);
    }
    /**
     * Update a skinned mesh's per-vertex joint indices.
     * @param {WebObjectHandle} handle
     * @param {Float32Array} joints
     */
    setSkinJoints(handle, joints) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passArrayF32ToWasm0(joints, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setSkinJoints(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * Update a skinned mesh's per-vertex bone weights.
     * @param {WebObjectHandle} handle
     * @param {Float32Array} weights
     */
    setSkinWeights(handle, weights) {
        _assertClass(handle, WebObjectHandle);
        const ptr0 = passArrayF32ToWasm0(weights, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webscene_setSkinWeights(this.__wbg_ptr, handle.__wbg_ptr, ptr0, len0);
    }
    /**
     * Update an object's transform (position + quaternion).
     * @param {WebObjectHandle} handle
     * @param {WebVector3} pos
     * @param {WebEuler} rot
     */
    setTransform(handle, pos, rot) {
        _assertClass(handle, WebObjectHandle);
        _assertClass(pos, WebVector3);
        _assertClass(rot, WebEuler);
        wasm.webscene_setTransform(this.__wbg_ptr, handle.__wbg_ptr, pos.__wbg_ptr, rot.__wbg_ptr);
    }
    /**
     * Set visibility.
     * @param {WebObjectHandle} handle
     * @param {boolean} visible
     */
    setVisible(handle, visible) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_setVisible(this.__wbg_ptr, handle.__wbg_ptr, visible);
    }
    /**
     * Set the background color (clear color).
     * @param {WebColor} color
     */
    set background(color) {
        _assertClass(color, WebColor);
        wasm.webscene_set_background(this.__wbg_ptr, color.__wbg_ptr);
    }
    /**
     * Replace a LineSegments object's geometry after JS-side attribute edits
     * (e.g. `computeLineDistances()` after `scene.add()`).
     * @param {WebObjectHandle} handle
     * @param {WebBufferGeometry} geom
     */
    syncLineGeometry(handle, geom) {
        _assertClass(handle, WebObjectHandle);
        _assertClass(geom, WebBufferGeometry);
        wasm.webscene_syncLineGeometry(this.__wbg_ptr, handle.__wbg_ptr, geom.__wbg_ptr);
    }
    /**
     * Apply a translation to the object's local position.
     * @param {WebObjectHandle} handle
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     */
    translate(handle, dx, dy, dz) {
        _assertClass(handle, WebObjectHandle);
        wasm.webscene_translate(this.__wbg_ptr, handle.__wbg_ptr, dx, dy, dz);
    }
    /**
     * Replace a light already in the scene with the wrapper's current state.
     *
     * `addLight` copies the light in, so every setter on the `WebLight`
     * afterwards writes to a handle the renderer never reads again — moving a
     * light, or changing its colour or intensity, silently did nothing once it
     * had been added. This pushes the wrapper's state back over the scene's
     * copy; the shim calls it from every light setter.
     * @param {WebObjectHandle} handle
     * @param {WebLight} light
     */
    updateLight(handle, light) {
        _assertClass(handle, WebObjectHandle);
        _assertClass(light, WebLight);
        wasm.webscene_updateLight(this.__wbg_ptr, handle.__wbg_ptr, light.__wbg_ptr);
    }
}
if (Symbol.dispose) WebScene.prototype[Symbol.dispose] = WebScene.prototype.free;

/**
 * A custom-shader material, from JavaScript.
 *
 * three.js's `ShaderMaterial` is one of the most-used classes in the library
 * and this had no counterpart at all, so every custom shader in the crate was
 * reachable from Rust and from nowhere else — which for a package that ships
 * to npm is most of the audience.
 *
 * The WGSL contract is the one documented on
 * [`crate::ShaderMaterial`]: a fragment defining
 * `@fragment fn fs_main(in: VsOut) -> @location(0) vec4<f32>`, optionally a
 * vertex stage defining `@vertex fn vs_custom`, both compiled against the
 * renderer's preamble.
 *
 * ```js
 * const m = new THREE.ShaderMaterial(`
 *   @fragment
 *   fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
 *     let tint = u_data.data[0].rgb;
 *     return vec4<f32>(framebuffer_encode(apply_tone_mapping(tint)), 1.0);
 *   }
 * `);
 * m.setData([1.0, 0.3, 0.1, 1.0]);
 * scene.add(new THREE.Mesh(geometry, m.material()));
 * ```
 *
 * On WebGL2 there are no storage buffers, so read the storage slots through
 * `s0(i)`/`s1(i)`/`s2(i)` rather than `u_s0[i]` — those are defined on every
 * backend and fall back to a texture where they have to.
 */
export class WebShaderMaterial {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebShaderMaterialFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webshadermaterial_free(ptr, 0);
    }
    /**
     * The material to hand to a `Mesh`.
     *
     * Every material this returns shares this one's uniform and storage, so
     * `setData`, `setUniform`, `setStorage` and `setStorageRange` afterwards
     * reach meshes that already hold it. The other settings are copied at the
     * time of the call.
     * @returns {WebMaterial}
     */
    material() {
        const ret = wasm.webshadermaterial_material(this.__wbg_ptr);
        return WebMaterial.__wrap(ret);
    }
    /**
     * `fragment` is WGSL defining `@fragment fn fs_main`.
     * @param {string} fragment
     */
    constructor(fragment) {
        const ptr0 = passStringToWasm0(fragment, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webshadermaterial_new(ptr0, len0);
        this.__wbg_ptr = ret;
        WebShaderMaterialFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The uniform block, as a flat array of floats read four at a time into
     * `u_data.data[0..16]`. Anything past sixty-four floats is ignored.
     *
     * In place: every mesh already holding a `material()` of this one sees
     * it on the next frame, and the cost is one 256-byte write.
     * @param {Float32Array} data
     */
    setData(data) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webshadermaterial_setData(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Consecutive floats of the uniform block starting at float `offset`.
     * @param {number} offset
     * @param {Float32Array} values
     */
    setDataRange(offset, values) {
        const ptr0 = passArrayF32ToWasm0(values, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webshadermaterial_setDataRange(this.__wbg_ptr, offset, ptr0, len0);
    }
    /**
     * Override depth writing: by default opaque writes and blended does not.
     * @param {boolean} write
     */
    setDepthWrite(write) {
        wasm.webshadermaterial_setDepthWrite(this.__wbg_ptr, write);
    }
    /**
     * @param {number} opacity
     */
    setOpacity(opacity) {
        wasm.webshadermaterial_setOpacity(this.__wbg_ptr, opacity);
    }
    /**
     * Draw in the screen-space pass, with the opaque scene available to
     * sample — what screen-space refraction needs.
     * @param {boolean} on
     */
    setScreenSpace(on) {
        wasm.webshadermaterial_setScreenSpace(this.__wbg_ptr, on);
    }
    /**
     * `0` FrontSide, `1` BackSide, `2` DoubleSide — three.js's `side`.
     * @param {number} side
     */
    setSide(side) {
        wasm.webshadermaterial_setSide(this.__wbg_ptr, side);
    }
    /**
     * One of the three storage slots, read as `s0(i)`, `s1(i)` or `s2(i)`.
     *
     * Use those rather than `u_s0[i]`: on WebGL2 there are no storage buffers
     * and the same data arrives as a texture instead, which the accessors
     * know about and a raw index does not.
     *
     * In place, like [`setData`](Self::set_data); the whole slot is uploaded
     * once, on the next frame.
     * @param {number} slot
     * @param {Float32Array} data
     */
    setStorage(slot, data) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webshadermaterial_setStorage(this.__wbg_ptr, slot, ptr0, len0);
    }
    /**
     * Overwrite part of a storage slot from float `offset` on, and upload only
     * that part. For changing a few objects' attributes out of many.
     * @param {number} slot
     * @param {number} offset
     * @param {Float32Array} data
     */
    setStorageRange(slot, offset, data) {
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.webshadermaterial_setStorageRange(this.__wbg_ptr, slot, offset, ptr0, len0);
    }
    /**
     * @param {boolean} transparent
     */
    setTransparent(transparent) {
        wasm.webshadermaterial_setTransparent(this.__wbg_ptr, transparent);
    }
    /**
     * One float of the uniform block: `index` 5 is `u_data.data[1].y`.
     * In place, like [`setData`](Self::set_data).
     * @param {number} index
     * @param {number} value
     */
    setUniform(index, value) {
        wasm.webshadermaterial_setUniform(this.__wbg_ptr, index, value);
    }
    /**
     * WGSL defining `@vertex fn vs_custom(in: VsIn, ...) -> VsOut`.
     *
     * For anything whose position has to be computed rather than read — a
     * camera-facing ribbon, a strand, a billboard. `standard_vertex(in)` is
     * the built-in transform, so the usual shape is to take its output and
     * move it.
     * @param {string} vertex
     */
    setVertex(vertex) {
        const ptr0 = passStringToWasm0(vertex, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.webshadermaterial_setVertex(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Compile-check the shader, returning the error or `undefined`.
     *
     * Always `undefined` in a browser: naga is not in wgpu's wasm build, so
     * there is nothing to check against and the browser's own WGSL compiler
     * reports to the console instead. `validationAvailable()` says so rather
     * than letting an always-passing check look like a passing one.
     * @returns {string | undefined}
     */
    validate() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webshadermaterial_validate(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_export4(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Whether [`validate`](Self::validate) can check anything here.
     * @returns {boolean}
     */
    static validationAvailable() {
        const ret = wasm.webshadermaterial_validationAvailable();
        return ret !== 0;
    }
}
if (Symbol.dispose) WebShaderMaterial.prototype[Symbol.dispose] = WebShaderMaterial.prototype.free;

export class WebShape {
    static __wrap(ptr) {
        const obj = Object.create(WebShape.prototype);
        obj.__wbg_ptr = ptr;
        WebShapeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebShapeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webshape_free(ptr, 0);
    }
    /**
     * @param {WebPath} hole
     */
    addHole(hole) {
        _assertClass(hole, WebPath);
        wasm.webshape_addHole(this.__wbg_ptr, hole.__wbg_ptr);
    }
    /**
     * @param {WebPath} outline
     * @returns {WebShape}
     */
    static fromPath(outline) {
        _assertClass(outline, WebPath);
        const ret = wasm.webshape_fromPath(outline.__wbg_ptr);
        return WebShape.__wrap(ret);
    }
    /**
     * Read SVG path data as an outline plus holes: first subpath is the
     * outline, the rest are holes.
     * @param {string} d
     * @returns {WebShape}
     */
    static fromSvgPathData(d) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(d, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.webshape_fromSvgPathData(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WebShape.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    constructor() {
        const ret = wasm.webshape_new();
        this.__wbg_ptr = ret;
        WebShapeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Outline then holes, as one `d` string. Fill it with
     * `fill-rule="evenodd"` — see the Rust-side docs for why.
     * @param {number} precision
     * @returns {string}
     */
    toSvgPathData(precision) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.webshape_toSvgPathData(retptr, this.__wbg_ptr, precision);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) WebShape.prototype[Symbol.dispose] = WebShape.prototype.free;

export class WebSimplexNoise {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebSimplexNoiseFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_websimplexnoise_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.websimplexnoise_new();
        this.__wbg_ptr = ret;
        WebSimplexNoiseFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    noise2(x, y) {
        const ret = wasm.websimplexnoise_noise2(this.__wbg_ptr, x, y);
        return ret;
    }
}
if (Symbol.dispose) WebSimplexNoise.prototype[Symbol.dispose] = WebSimplexNoise.prototype.free;

export class WebSphere {
    static __wrap(ptr) {
        const obj = Object.create(WebSphere.prototype);
        obj.__wbg_ptr = ptr;
        WebSphereFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebSphereFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_websphere_free(ptr, 0);
    }
    /**
     * @param {WebVector3} p
     * @returns {boolean}
     */
    containsPoint(p) {
        _assertClass(p, WebVector3);
        const ret = wasm.websphere_containsPoint(this.__wbg_ptr, p.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {WebVector3} center
     * @param {number} radius
     */
    constructor(center, radius) {
        _assertClass(center, WebVector3);
        const ret = wasm.websphere_new(center.__wbg_ptr, radius);
        this.__wbg_ptr = ret;
        WebSphereFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebSphere.prototype[Symbol.dispose] = WebSphere.prototype.free;

export class WebSpherical {
    static __wrap(ptr) {
        const obj = Object.create(WebSpherical.prototype);
        obj.__wbg_ptr = ptr;
        WebSphericalFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebSphericalFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webspherical_free(ptr, 0);
    }
    /**
     * @param {number} radius
     * @param {number} phi
     * @param {number} theta
     */
    constructor(radius, phi, theta) {
        const ret = wasm.webspherical_new(radius, phi, theta);
        this.__wbg_ptr = ret;
        WebSphericalFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebVector3} v
     * @returns {WebSpherical}
     */
    static setFromVector3(v) {
        _assertClass(v, WebVector3);
        const ret = wasm.webspherical_setFromVector3(v.__wbg_ptr);
        return WebSpherical.__wrap(ret);
    }
}
if (Symbol.dispose) WebSpherical.prototype[Symbol.dispose] = WebSpherical.prototype.free;

export class WebStats {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebStatsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webstats_free(ptr, 0);
    }
    begin() {
        wasm.webstats_begin(this.__wbg_ptr);
    }
    end() {
        wasm.webstats_end(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    get fps() {
        const ret = wasm.webstats_fps(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get frameMs() {
        const ret = wasm.webstats_frameMs(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.webstats_new();
        this.__wbg_ptr = ret;
        WebStatsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebStats.prototype[Symbol.dispose] = WebStats.prototype.free;

export class WebStlLoader {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebStlLoaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webstlloader_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.webstlloader_new();
        this.__wbg_ptr = ret;
        WebStlLoaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @returns {WebGeometry}
     */
    parse(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webstlloader_parse(this.__wbg_ptr, ptr0, len0);
        return WebGeometry.__wrap(ret);
    }
}
if (Symbol.dispose) WebStlLoader.prototype[Symbol.dispose] = WebStlLoader.prototype.free;

export class WebSvgRenderer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebSvgRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_websvgrenderer_free(ptr, 0);
    }
    /**
     * Go back to taking the background from the scene.
     */
    clearClearColor() {
        wasm.websvgrenderer_clearClearColor(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.websvgrenderer_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} w
     * @param {number} h
     */
    constructor(w, h) {
        const ret = wasm.websvgrenderer_new(w, h);
        this.__wbg_ptr = ret;
        WebSvgRendererFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebScene} scene
     * @param {WebCamera} camera
     * @returns {string}
     */
    renderToString(scene, camera) {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            _assertClass(scene, WebScene);
            _assertClass(camera, WebCamera);
            wasm.websvgrenderer_renderToString(retptr, this.__wbg_ptr, scene.__wbg_ptr, camera.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Emit `scene.background` as a full-canvas rect. Off gives a transparent
     * document that sits on whatever is behind it in the page.
     * @param {boolean} on
     */
    setBackground(on) {
        wasm.websvgrenderer_setBackground(this.__wbg_ptr, on);
    }
    /**
     * Background colour as `0xRRGGBB`, overriding `scene.background`. Mirrors
     * three.js's `setClearColor`.
     * @param {number} hex
     * @param {number} alpha
     */
    setClearColor(hex, alpha) {
        wasm.websvgrenderer_setClearColor(this.__wbg_ptr, hex, alpha);
    }
    /**
     * @param {boolean} on
     */
    setCullBackfaces(on) {
        wasm.websvgrenderer_setCullBackfaces(this.__wbg_ptr, on);
    }
    /**
     * Draw a face's edges as Bézier curves when a straight one would miss the
     * real surface by more than this many pixels. Pass a value of 0 or less to
     * keep every edge straight.
     * @param {number} px
     */
    setCurveTolerance(px) {
        wasm.websvgrenderer_setCurveTolerance(this.__wbg_ptr, px);
    }
    /**
     * Split faces spanning more than this fraction of their own distance from
     * the camera, so the depth sort has something meaningful to order. 0 or
     * less disables splitting.
     * @param {number} tolerance
     */
    setDepthSplit(tolerance) {
        wasm.websvgrenderer_setDepthSplit(this.__wbg_ptr, tolerance);
    }
    /**
     * Decimal places kept on coordinates. Lower is a smaller document.
     * @param {number} places
     */
    setPrecision(places) {
        wasm.websvgrenderer_setPrecision(this.__wbg_ptr, places);
    }
    /**
     * Hairline stroke per face, in pixels, that hides the light seams SVG
     * leaves along shared edges. 0 disables it.
     * @param {number} px
     */
    setSeamStroke(px) {
        wasm.websvgrenderer_setSeamStroke(this.__wbg_ptr, px);
    }
    /**
     * `0` lit (default), `1` flat material colour, `2` wireframe.
     * @param {number} mode
     */
    setShading(mode) {
        wasm.websvgrenderer_setShading(this.__wbg_ptr, mode);
    }
    /**
     * Resize the canvas, keeping every option set so far.
     * @param {number} width
     * @param {number} height
     */
    setSize(width, height) {
        wasm.websvgrenderer_setSize(this.__wbg_ptr, width, height);
    }
    /**
     * Depth-sort faces back to front. Off only makes sense when the caller has
     * already ordered the scene.
     * @param {boolean} on
     */
    setSort(on) {
        wasm.websvgrenderer_setSort(this.__wbg_ptr, on);
    }
    /**
     * Same three.js constants as
     * [`WebRenderer::setToneMapping`](WebRenderer::set_tone_mapping): `0`
     * NoToneMapping, `1` Linear, `4` ACESFilmic.
     * @param {number} mode
     * @param {number} exposure
     */
    setToneMapping(mode, exposure) {
        wasm.websvgrenderer_setToneMapping(this.__wbg_ptr, mode, exposure);
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.websvgrenderer_width(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WebSvgRenderer.prototype[Symbol.dispose] = WebSvgRenderer.prototype.free;

export class WebTexture {
    static __wrap(ptr) {
        const obj = Object.create(WebTexture.prototype);
        obj.__wbg_ptr = ptr;
        WebTextureFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebTextureFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webtexture_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    height() {
        const ret = wasm.webtexture_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {Uint8Array} data
     */
    constructor(width, height, data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webtexture_new(width, height, ptr0, len0);
        this.__wbg_ptr = ret;
        WebTextureFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Set sampler filter/wrap. 0 = LinearFilter, 1 = NearestFilter.
     * 0 = ClampToEdge, 1 = Repeat, 2 = MirroredRepeat.
     * @param {number} mag
     * @param {number} _min
     * @param {number} wrap_s
     * @param {number} wrap_t
     */
    setFilters(mag, _min, wrap_s, wrap_t) {
        wasm.webtexture_setFilters(this.__wbg_ptr, mag, _min, wrap_s, wrap_t);
    }
    /**
     * three.js `Texture.offset` / `Texture.repeat` — the UV sub-rectangle this
     * texture covers. What lets several meshes share one atlas.
     * @param {number} ox
     * @param {number} oy
     * @param {number} rx
     * @param {number} ry
     */
    setUvTransform(ox, oy, rx, ry) {
        wasm.webtexture_setUvTransform(this.__wbg_ptr, ox, oy, rx, ry);
    }
    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     * @returns {WebTexture}
     */
    static solid(r, g, b, a) {
        const ret = wasm.webtexture_solid(r, g, b, a);
        return WebTexture.__wrap(ret);
    }
    /**
     * A second handle on the same pixels, carrying its own UV transform.
     *
     * `Texture`'s bytes live behind their own `Arc`, so this clones a handle
     * and not an image — and the renderer keys its GPU cache on those bytes,
     * so every view of one buffer shares a single upload between them.
     *
     * This is what lets a body split into patches for tile streaming still
     * cost one texture per map at level 0: eight patches over one map, each
     * addressing its own quarter through `offset`/`repeat`, instead of eight
     * sliced copies uploaded separately.
     * @param {number} ox
     * @param {number} oy
     * @param {number} rx
     * @param {number} ry
     * @returns {WebDataTexture}
     */
    view(ox, oy, rx, ry) {
        const ret = wasm.webtexture_view(this.__wbg_ptr, ox, oy, rx, ry);
        return WebDataTexture.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    width() {
        const ret = wasm.webtexture_width(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WebTexture.prototype[Symbol.dispose] = WebTexture.prototype.free;

export class WebTrackballControls {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebTrackballControlsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webtrackballcontrols_free(ptr, 0);
    }
    /**
     * @param {WebCamera} camera
     */
    constructor(camera) {
        _assertClass(camera, WebCamera);
        const ret = wasm.webtrackballcontrols_new(camera.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebTrackballControlsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {WebCamera} camera
     * @param {number} dx
     * @param {number} dy
     * @param {number} wheel
     * @param {boolean} rotating
     * @param {boolean} panning
     * @param {number} w
     * @param {number} h
     */
    update(camera, dx, dy, wheel, rotating, panning, w, h) {
        _assertClass(camera, WebCamera);
        wasm.webtrackballcontrols_update(this.__wbg_ptr, camera.__wbg_ptr, dx, dy, wheel, rotating, panning, w, h);
    }
}
if (Symbol.dispose) WebTrackballControls.prototype[Symbol.dispose] = WebTrackballControls.prototype.free;

export class WebTriangle {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebTriangleFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webtriangle_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    area() {
        const ret = wasm.webtriangle_area(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WebVector3} a
     * @param {WebVector3} b
     * @param {WebVector3} c
     */
    constructor(a, b, c) {
        _assertClass(a, WebVector3);
        _assertClass(b, WebVector3);
        _assertClass(c, WebVector3);
        const ret = wasm.webtriangle_new(a.__wbg_ptr, b.__wbg_ptr, c.__wbg_ptr);
        this.__wbg_ptr = ret;
        WebTriangleFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {WebVector3}
     */
    normal() {
        const ret = wasm.webtriangle_normal(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
}
if (Symbol.dispose) WebTriangle.prototype[Symbol.dispose] = WebTriangle.prototype.free;

export class WebVector2 {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebVector2Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webvector2_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_webvector2_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_webvector2_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_webvector2_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_webvector2_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {WebVector2} o
     * @returns {number}
     */
    dot(o) {
        _assertClass(o, WebVector2);
        const ret = wasm.webvector2_dot(this.__wbg_ptr, o.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.webvector2_length(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    lengthSq() {
        const ret = wasm.webvector2_lengthSq(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        const ret = wasm.webvector2_new(x, y);
        this.__wbg_ptr = ret;
        WebVector2Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebVector2.prototype[Symbol.dispose] = WebVector2.prototype.free;

export class WebVector3 {
    static __wrap(ptr) {
        const obj = Object.create(WebVector3.prototype);
        obj.__wbg_ptr = ptr;
        WebVector3Finalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebVector3Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webvector3_free(ptr, 0);
    }
    /**
     * @param {WebVector3} o
     * @returns {WebVector3}
     */
    add(o) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_add(this.__wbg_ptr, o.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebMatrix4} m
     * @returns {WebVector3}
     */
    applyMatrix4(m) {
        _assertClass(m, WebMatrix4);
        const ret = wasm.webvector3_applyMatrix4(this.__wbg_ptr, m.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebQuaternion} q
     * @returns {WebVector3}
     */
    applyQuaternion(q) {
        _assertClass(q, WebQuaternion);
        const ret = wasm.webvector3_applyQuaternion(this.__wbg_ptr, q.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebVector3} o
     * @returns {WebVector3}
     */
    cross(o) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_cross(this.__wbg_ptr, o.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebVector3} o
     * @returns {number}
     */
    distanceTo(o) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_distanceTo(this.__wbg_ptr, o.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WebVector3} o
     * @returns {number}
     */
    dot(o) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_dot(this.__wbg_ptr, o.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.webvector3_length(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    lengthSq() {
        const ret = wasm.webvector3_lengthSq(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {WebVector3} o
     * @param {number} t
     * @returns {WebVector3}
     */
    lerp(o, t) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_lerp(this.__wbg_ptr, o.__wbg_ptr, t);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {number} s
     * @returns {WebVector3}
     */
    multiplyScalar(s) {
        const ret = wasm.webvector3_multiplyScalar(this.__wbg_ptr, s);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x, y, z) {
        const ret = wasm.webvector3_new(x, y, z);
        this.__wbg_ptr = ret;
        WebVector3Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {WebVector3}
     */
    normalize() {
        const ret = wasm.webvector3_normalize(this.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @param {WebVector3} o
     * @returns {WebVector3}
     */
    sub(o) {
        _assertClass(o, WebVector3);
        const ret = wasm.webvector3_sub(this.__wbg_ptr, o.__wbg_ptr);
        return WebVector3.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.webvector3_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.webvector3_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.webvector3_z(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) WebVector3.prototype[Symbol.dispose] = WebVector3.prototype.free;

export class WebVector4 {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebVector4Finalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webvector4_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get w() {
        const ret = wasm.__wbg_get_webvector4_w(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get x() {
        const ret = wasm.__wbg_get_webvector4_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get y() {
        const ret = wasm.__wbg_get_webvector4_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get z() {
        const ret = wasm.__wbg_get_webvector4_z(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set w(arg0) {
        wasm.__wbg_set_webvector4_w(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set x(arg0) {
        wasm.__wbg_set_webvector4_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set y(arg0) {
        wasm.__wbg_set_webvector4_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set z(arg0) {
        wasm.__wbg_set_webvector4_z(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    length() {
        const ret = wasm.webvector4_length(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} w
     */
    constructor(x, y, z, w) {
        const ret = wasm.webvector4_new(x, y, z, w);
        this.__wbg_ptr = ret;
        WebVector4Finalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) WebVector4.prototype[Symbol.dispose] = WebVector4.prototype.free;

/**
 * Wrap an RGBA frame — typically read back off a canvas — in an SVG document
 * as an embedded PNG. The counterpart to [`WebSvgRenderer`] for when the scene
 * needs the real renderer's textures, shadows or post-fx and a per-face
 * painter's algorithm will not do.
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} rgba
 * @returns {string}
 */
export function svgFromRgba(width, height, rgba) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(rgba, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.svgFromRgba(retptr, width, height, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred3_0, deferred3_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Window_afcc911b2f9c92e2: function(arg0) {
            const ret = getObject(arg0).Window;
            return addHeapObject(ret);
        },
        __wbg_WorkerGlobalScope_5d19ebc889ff397e: function(arg0) {
            const ret = getObject(arg0).WorkerGlobalScope;
            return addHeapObject(ret);
        },
        __wbg___wbindgen_boolean_get_1a45e2c38d4d41b9: function(arg0) {
            const v = getObject(arg0);
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_0accd80f45e5faa2: function(arg0, arg1) {
            const ret = debugString(getObject(arg1));
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_754e9f305ff6029e: function(arg0) {
            const ret = typeof(getObject(arg0)) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_87c3bfe968c6a5ad: function(arg0) {
            const ret = getObject(arg0) === null;
            return ret;
        },
        __wbg___wbindgen_is_null_or_undefined_cf617b836541fad3: function(arg0) {
            const ret = getObject(arg0) == null;
            return ret;
        },
        __wbg___wbindgen_is_string_c236cabd84a4d769: function(arg0) {
            const ret = typeof(getObject(arg0)) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_67b456be8673d3d7: function(arg0) {
            const ret = getObject(arg0) === undefined;
            return ret;
        },
        __wbg___wbindgen_number_get_9bb1761122181af2: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_72bdf95d3ae505b1: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_61db23ac97f16c31: function(arg0) {
            getObject(arg0)._wbg_cb_unref();
        },
        __wbg_activeTexture_7a0d6fe7120979ce: function(arg0, arg1) {
            getObject(arg0).activeTexture(arg1 >>> 0);
        },
        __wbg_activeTexture_dd15c31d50b73529: function(arg0, arg1) {
            getObject(arg0).activeTexture(arg1 >>> 0);
        },
        __wbg_attachShader_5c6a46e7c0fc637a: function(arg0, arg1, arg2) {
            getObject(arg0).attachShader(getObject(arg1), getObject(arg2));
        },
        __wbg_attachShader_c2b12b36afa45936: function(arg0, arg1, arg2) {
            getObject(arg0).attachShader(getObject(arg1), getObject(arg2));
        },
        __wbg_beginQuery_c37ba60854548ce4: function(arg0, arg1, arg2) {
            getObject(arg0).beginQuery(arg1 >>> 0, getObject(arg2));
        },
        __wbg_beginRenderPass_aa22c432e793359a: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).beginRenderPass(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_bindAttribLocation_0c6f2ea6125fdef0: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).bindAttribLocation(getObject(arg1), arg2 >>> 0, getStringFromWasm0(arg3, arg4));
        },
        __wbg_bindAttribLocation_2402acacea8c9052: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).bindAttribLocation(getObject(arg1), arg2 >>> 0, getStringFromWasm0(arg3, arg4));
        },
        __wbg_bindBufferRange_8c74a962306d3edc: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).bindBufferRange(arg1 >>> 0, arg2 >>> 0, getObject(arg3), arg4, arg5);
        },
        __wbg_bindBuffer_3841df88ccee4ed0: function(arg0, arg1, arg2) {
            getObject(arg0).bindBuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindBuffer_aa5dc7dc1c8ad1c8: function(arg0, arg1, arg2) {
            getObject(arg0).bindBuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindFramebuffer_10bbdf7040d89a17: function(arg0, arg1, arg2) {
            getObject(arg0).bindFramebuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindFramebuffer_ee8e42543c29c602: function(arg0, arg1, arg2) {
            getObject(arg0).bindFramebuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindRenderbuffer_7808d8eabbe18554: function(arg0, arg1, arg2) {
            getObject(arg0).bindRenderbuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindRenderbuffer_c0360bfb79c193c2: function(arg0, arg1, arg2) {
            getObject(arg0).bindRenderbuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindSampler_508a317f07fcc79b: function(arg0, arg1, arg2) {
            getObject(arg0).bindSampler(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindTexture_28d1d695d4801955: function(arg0, arg1, arg2) {
            getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindTexture_a1a012a31e1419d5: function(arg0, arg1, arg2) {
            getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindVertexArrayOES_15e48910a5d208b1: function(arg0, arg1) {
            getObject(arg0).bindVertexArrayOES(getObject(arg1));
        },
        __wbg_bindVertexArray_4f2f0a7892280041: function(arg0, arg1) {
            getObject(arg0).bindVertexArray(getObject(arg1));
        },
        __wbg_blendColor_be83ea8178af1236: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendColor(arg1, arg2, arg3, arg4);
        },
        __wbg_blendColor_e0abbfaf6efb7918: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendColor(arg1, arg2, arg3, arg4);
        },
        __wbg_blendEquationSeparate_092287556c43cac6: function(arg0, arg1, arg2) {
            getObject(arg0).blendEquationSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_blendEquationSeparate_12afacb791d717a4: function(arg0, arg1, arg2) {
            getObject(arg0).blendEquationSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_blendEquation_1ced323efc9ce0f8: function(arg0, arg1) {
            getObject(arg0).blendEquation(arg1 >>> 0);
        },
        __wbg_blendEquation_a12f5acd9d14fb9b: function(arg0, arg1) {
            getObject(arg0).blendEquation(arg1 >>> 0);
        },
        __wbg_blendFuncSeparate_bdc7f9846e27b1be: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_blendFuncSeparate_ebd4f4459ce5d4ff: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_blendFunc_d5202c7fe94c67ee: function(arg0, arg1, arg2) {
            getObject(arg0).blendFunc(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_blendFunc_fbff85cd0fce280e: function(arg0, arg1, arg2) {
            getObject(arg0).blendFunc(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_blitFramebuffer_acb954bfb30ed714: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
            getObject(arg0).blitFramebuffer(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0);
        },
        __wbg_bufferData_043a7e5da22f40d9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferData(arg1 >>> 0, arg2, arg3 >>> 0);
        },
        __wbg_bufferData_7b6881381d415425: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferData(arg1 >>> 0, getObject(arg2), arg3 >>> 0);
        },
        __wbg_bufferData_9fddca30299e6114: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferData(arg1 >>> 0, arg2, arg3 >>> 0);
        },
        __wbg_bufferData_f0837cec09725cc0: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferData(arg1 >>> 0, getObject(arg2), arg3 >>> 0);
        },
        __wbg_bufferSubData_885e4f8d5833cf11: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferSubData(arg1 >>> 0, arg2, getObject(arg3));
        },
        __wbg_bufferSubData_8fc824b6a9503f12: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferSubData(arg1 >>> 0, arg2, getObject(arg3));
        },
        __wbg_call_40e4174f169eaca7: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2), getObject(arg3));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_call_9c758de292015997: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_clearBufferfv_2e2858bd8bcf1715: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).clearBufferfv(arg1 >>> 0, arg2, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_clearBufferiv_e356514eb1d165fe: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).clearBufferiv(arg1 >>> 0, arg2, getArrayI32FromWasm0(arg3, arg4));
        },
        __wbg_clearBufferuiv_ca8ecce5210a44b6: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).clearBufferuiv(arg1 >>> 0, arg2, getArrayU32FromWasm0(arg3, arg4));
        },
        __wbg_clearDepth_ba71a8e650098b51: function(arg0, arg1) {
            getObject(arg0).clearDepth(arg1);
        },
        __wbg_clearDepth_e9c11e3935d6a5cb: function(arg0, arg1) {
            getObject(arg0).clearDepth(arg1);
        },
        __wbg_clearStencil_b25f21e1d96d7269: function(arg0, arg1) {
            getObject(arg0).clearStencil(arg1);
        },
        __wbg_clearStencil_d345fa9acf9c6076: function(arg0, arg1) {
            getObject(arg0).clearStencil(arg1);
        },
        __wbg_clear_94ddf6f335ac6541: function(arg0, arg1) {
            getObject(arg0).clear(arg1 >>> 0);
        },
        __wbg_clear_a9bb0742cea539be: function(arg0, arg1) {
            getObject(arg0).clear(arg1 >>> 0);
        },
        __wbg_clientWaitSync_509a3ed61fa3d4ba: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).clientWaitSync(getObject(arg1), arg2 >>> 0, arg3 >>> 0);
            return ret;
        },
        __wbg_colorMask_60cf501712dd105e: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).colorMask(arg1 !== 0, arg2 !== 0, arg3 !== 0, arg4 !== 0);
        },
        __wbg_colorMask_f6c19a77a2ba8791: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).colorMask(arg1 !== 0, arg2 !== 0, arg3 !== 0, arg4 !== 0);
        },
        __wbg_compileShader_8810a4868b23621b: function(arg0, arg1) {
            getObject(arg0).compileShader(getObject(arg1));
        },
        __wbg_compileShader_ec8d5eb7f2b70a48: function(arg0, arg1) {
            getObject(arg0).compileShader(getObject(arg1));
        },
        __wbg_compressedTexSubImage2D_52f582e58ae63655: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
            getObject(arg0).compressedTexSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, getObject(arg8));
        },
        __wbg_compressedTexSubImage2D_5b49c280323ac2a4: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).compressedTexSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8, arg9);
        },
        __wbg_compressedTexSubImage2D_e4bf2c9e99772afc: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
            getObject(arg0).compressedTexSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, getObject(arg8));
        },
        __wbg_compressedTexSubImage3D_40935ad9321fccff: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
            getObject(arg0).compressedTexSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, getObject(arg10));
        },
        __wbg_compressedTexSubImage3D_a96ed5658b462555: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).compressedTexSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10, arg11);
        },
        __wbg_configure_0e4789c0f6b35c8e: function() { return handleError(function (arg0, arg1) {
            getObject(arg0).configure(getObject(arg1));
        }, arguments); },
        __wbg_copyBufferSubData_9936fdf5e53e1832: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).copyBufferSubData(arg1 >>> 0, arg2 >>> 0, arg3, arg4, arg5);
        },
        __wbg_copyBufferToBuffer_5e2cd8f10ae78183: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).copyBufferToBuffer(getObject(arg1), arg2, getObject(arg3), arg4);
        }, arguments); },
        __wbg_copyBufferToBuffer_ca30deb8de65f5d5: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).copyBufferToBuffer(getObject(arg1), arg2, getObject(arg3), arg4, arg5);
        }, arguments); },
        __wbg_copyTexSubImage2D_8268384cef89524f: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
            getObject(arg0).copyTexSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
        },
        __wbg_copyTexSubImage2D_dd243d0849a83134: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
            getObject(arg0).copyTexSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
        },
        __wbg_copyTexSubImage3D_04ec138b69a98dc5: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).copyTexSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9);
        },
        __wbg_copyTextureToBuffer_ed6e67a77ecb768d: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            getObject(arg0).copyTextureToBuffer(getObject(arg1), getObject(arg2), getObject(arg3));
        }, arguments); },
        __wbg_copyTextureToTexture_c3f8f1b9c260ecf4: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            getObject(arg0).copyTextureToTexture(getObject(arg1), getObject(arg2), getObject(arg3));
        }, arguments); },
        __wbg_createBindGroupLayout_49a7e2b3d076afcf: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createBindGroupLayout(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_createBindGroup_655c6e6c0258530e: function(arg0, arg1) {
            const ret = getObject(arg0).createBindGroup(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_createBuffer_0726dd2ab09ea1d2: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createBuffer(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_createBuffer_333d6aae40284594: function(arg0) {
            const ret = getObject(arg0).createBuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createBuffer_3ae54605e5676c83: function(arg0) {
            const ret = getObject(arg0).createBuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createCommandEncoder_ec1f40f0cb4d09df: function(arg0, arg1) {
            const ret = getObject(arg0).createCommandEncoder(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_createFramebuffer_6f42ff976bb98152: function(arg0) {
            const ret = getObject(arg0).createFramebuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createFramebuffer_ef1247e8b2e9b09f: function(arg0) {
            const ret = getObject(arg0).createFramebuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createPipelineLayout_2c8cd4528b06c108: function(arg0, arg1) {
            const ret = getObject(arg0).createPipelineLayout(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_createProgram_b48c3323af547213: function(arg0) {
            const ret = getObject(arg0).createProgram();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createProgram_f6a8df4491031d57: function(arg0) {
            const ret = getObject(arg0).createProgram();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createQuerySet_cb7b21d1d405b890: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createQuerySet(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_createQuery_15b912daa75c8dbf: function(arg0) {
            const ret = getObject(arg0).createQuery();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createRenderPipeline_cf98d4d699bfb03c: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createRenderPipeline(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_createRenderbuffer_a2f947c7fa8c8bf0: function(arg0) {
            const ret = getObject(arg0).createRenderbuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createRenderbuffer_c09d5809ac95924e: function(arg0) {
            const ret = getObject(arg0).createRenderbuffer();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createSampler_9199d87b2f018789: function(arg0) {
            const ret = getObject(arg0).createSampler();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createSampler_c8ffb3c8d565f704: function(arg0, arg1) {
            const ret = getObject(arg0).createSampler(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_createShaderModule_2e44fc7677c6288b: function(arg0, arg1) {
            const ret = getObject(arg0).createShaderModule(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_createShader_0e3f814b69e9e184: function(arg0, arg1) {
            const ret = getObject(arg0).createShader(arg1 >>> 0);
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createShader_383b3295276271d2: function(arg0, arg1) {
            const ret = getObject(arg0).createShader(arg1 >>> 0);
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createTexture_1bac74c999b8a48e: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createTexture(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_createTexture_461a3048c40e7175: function(arg0) {
            const ret = getObject(arg0).createTexture();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createTexture_d6e2c1f04a554a15: function(arg0) {
            const ret = getObject(arg0).createTexture();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createVertexArrayOES_2f67d3679ba9a29c: function(arg0) {
            const ret = getObject(arg0).createVertexArrayOES();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createVertexArray_febd1d11636d15ad: function(arg0) {
            const ret = getObject(arg0).createVertexArray();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_createView_ceaf2f5881adbd34: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).createView(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_cullFace_a4ee8b8c3c126388: function(arg0, arg1) {
            getObject(arg0).cullFace(arg1 >>> 0);
        },
        __wbg_cullFace_c6b39a55ccade015: function(arg0, arg1) {
            getObject(arg0).cullFace(arg1 >>> 0);
        },
        __wbg_deleteBuffer_520156dc8a1f81af: function(arg0, arg1) {
            getObject(arg0).deleteBuffer(getObject(arg1));
        },
        __wbg_deleteBuffer_a925fdd1b590fbbc: function(arg0, arg1) {
            getObject(arg0).deleteBuffer(getObject(arg1));
        },
        __wbg_deleteFramebuffer_aa4bf9f184123318: function(arg0, arg1) {
            getObject(arg0).deleteFramebuffer(getObject(arg1));
        },
        __wbg_deleteFramebuffer_cc043e5a8cb9a556: function(arg0, arg1) {
            getObject(arg0).deleteFramebuffer(getObject(arg1));
        },
        __wbg_deleteProgram_0c859ebcab2b7b5a: function(arg0, arg1) {
            getObject(arg0).deleteProgram(getObject(arg1));
        },
        __wbg_deleteProgram_df6a6609c7d91a6e: function(arg0, arg1) {
            getObject(arg0).deleteProgram(getObject(arg1));
        },
        __wbg_deleteQuery_0d05b9f957f3c65b: function(arg0, arg1) {
            getObject(arg0).deleteQuery(getObject(arg1));
        },
        __wbg_deleteRenderbuffer_37c079dbc257fcf9: function(arg0, arg1) {
            getObject(arg0).deleteRenderbuffer(getObject(arg1));
        },
        __wbg_deleteRenderbuffer_4b7a888363766554: function(arg0, arg1) {
            getObject(arg0).deleteRenderbuffer(getObject(arg1));
        },
        __wbg_deleteSampler_b1a9742449ecf1a7: function(arg0, arg1) {
            getObject(arg0).deleteSampler(getObject(arg1));
        },
        __wbg_deleteShader_170dea06bd074d01: function(arg0, arg1) {
            getObject(arg0).deleteShader(getObject(arg1));
        },
        __wbg_deleteShader_944accd60733a9cb: function(arg0, arg1) {
            getObject(arg0).deleteShader(getObject(arg1));
        },
        __wbg_deleteSync_0bcbb8c5b926f68b: function(arg0, arg1) {
            getObject(arg0).deleteSync(getObject(arg1));
        },
        __wbg_deleteTexture_54dee8e15570751e: function(arg0, arg1) {
            getObject(arg0).deleteTexture(getObject(arg1));
        },
        __wbg_deleteTexture_be3eaabebb89a85e: function(arg0, arg1) {
            getObject(arg0).deleteTexture(getObject(arg1));
        },
        __wbg_deleteVertexArrayOES_4262d2d0e9fb77c5: function(arg0, arg1) {
            getObject(arg0).deleteVertexArrayOES(getObject(arg1));
        },
        __wbg_deleteVertexArray_8f0fb3b3d54c7483: function(arg0, arg1) {
            getObject(arg0).deleteVertexArray(getObject(arg1));
        },
        __wbg_depthFunc_d7102b620031da85: function(arg0, arg1) {
            getObject(arg0).depthFunc(arg1 >>> 0);
        },
        __wbg_depthFunc_e0a62c284e432e9b: function(arg0, arg1) {
            getObject(arg0).depthFunc(arg1 >>> 0);
        },
        __wbg_depthMask_95332b64c5ef8b45: function(arg0, arg1) {
            getObject(arg0).depthMask(arg1 !== 0);
        },
        __wbg_depthMask_f55bea4b6c3b9531: function(arg0, arg1) {
            getObject(arg0).depthMask(arg1 !== 0);
        },
        __wbg_depthRange_59dc2b4177cda939: function(arg0, arg1, arg2) {
            getObject(arg0).depthRange(arg1, arg2);
        },
        __wbg_depthRange_7d8ebdd5c85f6bfd: function(arg0, arg1, arg2) {
            getObject(arg0).depthRange(arg1, arg2);
        },
        __wbg_description_02485704e69b1e7f: function(arg0, arg1) {
            const ret = getObject(arg1).description;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_disableVertexAttribArray_26a215cd5febe0fb: function(arg0, arg1) {
            getObject(arg0).disableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_disableVertexAttribArray_d773124f037993d3: function(arg0, arg1) {
            getObject(arg0).disableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_disable_2cf98ccb81612ef9: function(arg0, arg1) {
            getObject(arg0).disable(arg1 >>> 0);
        },
        __wbg_disable_6b825656c54f5646: function(arg0, arg1) {
            getObject(arg0).disable(arg1 >>> 0);
        },
        __wbg_document_aceb08cd6489baf5: function(arg0) {
            const ret = getObject(arg0).document;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_drawArraysInstancedANGLE_e83f22061a582502: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).drawArraysInstancedANGLE(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_drawArraysInstanced_829c1a7d169b0acd: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).drawArraysInstanced(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_drawArrays_6eb87620c1dcbfb4: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
        },
        __wbg_drawArrays_f332b526550a641e: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
        },
        __wbg_drawBuffersWEBGL_10cdfe87c17cd93f: function(arg0, arg1) {
            getObject(arg0).drawBuffersWEBGL(getObject(arg1));
        },
        __wbg_drawBuffers_c5a9ee312b2d6fa8: function(arg0, arg1) {
            getObject(arg0).drawBuffers(getObject(arg1));
        },
        __wbg_drawElementsInstancedANGLE_f853d22b765ff300: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).drawElementsInstancedANGLE(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_drawElementsInstanced_bd0a4ec3f255763c: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).drawElementsInstanced(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_drawIndexed_d31913e79d58fbac: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).drawIndexed(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4, arg5 >>> 0);
        },
        __wbg_draw_6877f98847e1e36c: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).draw(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_enableVertexAttribArray_cc09a0312b6adee5: function(arg0, arg1) {
            getObject(arg0).enableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_enableVertexAttribArray_f88d3d499ab40ea6: function(arg0, arg1) {
            getObject(arg0).enableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_enable_1928c361308989d5: function(arg0, arg1) {
            getObject(arg0).enable(arg1 >>> 0);
        },
        __wbg_enable_2cc4ff32a0fd985f: function(arg0, arg1) {
            getObject(arg0).enable(arg1 >>> 0);
        },
        __wbg_endQuery_758636ad51df24b9: function(arg0, arg1) {
            getObject(arg0).endQuery(arg1 >>> 0);
        },
        __wbg_end_f99ebed53d4e198a: function(arg0) {
            getObject(arg0).end();
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_export4(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_features_d4d2020319592cbe: function(arg0) {
            const ret = getObject(arg0).features;
            return addHeapObject(ret);
        },
        __wbg_fenceSync_a838bd45b79c7556: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).fenceSync(arg1 >>> 0, arg2 >>> 0);
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_finish_4d91de5e927dd13f: function(arg0, arg1) {
            const ret = getObject(arg0).finish(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_finish_559e336ea257ce5c: function(arg0) {
            getObject(arg0).finish();
        },
        __wbg_finish_6e06b68ab68cd9f6: function(arg0) {
            const ret = getObject(arg0).finish();
            return addHeapObject(ret);
        },
        __wbg_finish_d8b13c027ab8a637: function(arg0) {
            getObject(arg0).finish();
        },
        __wbg_flush_2088ebca1fd13068: function(arg0) {
            getObject(arg0).flush();
        },
        __wbg_flush_3be48fce9f195fa5: function(arg0) {
            getObject(arg0).flush();
        },
        __wbg_framebufferRenderbuffer_0c9d0e5587497683: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).framebufferRenderbuffer(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4));
        },
        __wbg_framebufferRenderbuffer_599e58ad30dcfeb3: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).framebufferRenderbuffer(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4));
        },
        __wbg_framebufferTexture2D_44caed1725e57636: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).framebufferTexture2D(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5);
        },
        __wbg_framebufferTexture2D_fbba21b750c2316a: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).framebufferTexture2D(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5);
        },
        __wbg_framebufferTextureLayer_0c67e78e1eed92a6: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).framebufferTextureLayer(arg1 >>> 0, arg2 >>> 0, getObject(arg3), arg4, arg5);
        },
        __wbg_framebufferTextureMultiviewOVR_53cb0a8a804a1377: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).framebufferTextureMultiviewOVR(arg1 >>> 0, arg2 >>> 0, getObject(arg3), arg4, arg5, arg6);
        },
        __wbg_frontFace_213f25fadfde9560: function(arg0, arg1) {
            getObject(arg0).frontFace(arg1 >>> 0);
        },
        __wbg_frontFace_892c2c009a1ce14f: function(arg0, arg1) {
            getObject(arg0).frontFace(arg1 >>> 0);
        },
        __wbg_getBufferSubData_eb53c7b873cb3b4f: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).getBufferSubData(arg1 >>> 0, arg2, getObject(arg3));
        },
        __wbg_getContext_469d34698d869fc1: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getContext_5b39fff76491fded: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2), getObject(arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getContext_7d3a8f461c828713: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getContext_f9e85e58c413eeb4: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getContext(getStringFromWasm0(arg1, arg2), getObject(arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getCurrentTexture_20714d1bd9051cab: function() { return handleError(function (arg0) {
            const ret = getObject(arg0).getCurrentTexture();
            return addHeapObject(ret);
        }, arguments); },
        __wbg_getExtension_454cdc5ffd07bf03: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getExtension(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_getIndexedParameter_b89471689978f243: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getIndexedParameter(arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_getMappedRange_d0bf3141224111b6: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getMappedRange(arg1, arg2);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_getParameter_015942a7ad566b20: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).getParameter(arg1 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_getParameter_1e77e23f5ccf0300: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).getParameter(arg1 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_getPreferredCanvasFormat_8b57039d1801a506: function(arg0) {
            const ret = getObject(arg0).getPreferredCanvasFormat();
            return (__wbindgen_enum_GpuTextureFormat.indexOf(ret) + 1 || 102) - 1;
        },
        __wbg_getProgramInfoLog_2f9cfcecc4f772e1: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getProgramInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getProgramInfoLog_f0d48f606547aed7: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getProgramInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getProgramParameter_08beabb2736d5769: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getProgramParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getProgramParameter_aee848e1db52b7cd: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getProgramParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getQueryParameter_bb2c3b5d719b84d2: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getQueryParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getShaderInfoLog_510365af17f29a35: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getShaderInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getShaderInfoLog_cd77c7b7bdb9ce65: function(arg0, arg1, arg2) {
            const ret = getObject(arg1).getShaderInfoLog(getObject(arg2));
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_getShaderParameter_84daef80cb0e259f: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getShaderParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getShaderParameter_a8f3845ac42e4e82: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getShaderParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getSupportedExtensions_7a31b3412a25d9ba: function(arg0) {
            const ret = getObject(arg0).getSupportedExtensions();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_getSupportedProfiles_99bae4147e0aebec: function(arg0) {
            const ret = getObject(arg0).getSupportedProfiles();
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_getSyncParameter_b55a2db07912367a: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).getSyncParameter(getObject(arg1), arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_getUniformBlockIndex_e6a632fbdc107dd3: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getUniformBlockIndex(getObject(arg1), getStringFromWasm0(arg2, arg3));
            return ret;
        },
        __wbg_getUniformLocation_010256f946f9a865: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getUniformLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_getUniformLocation_f9774d4f157f5914: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).getUniformLocation(getObject(arg1), getStringFromWasm0(arg2, arg3));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_get_cb935c1402921898: function(arg0, arg1) {
            const ret = getObject(arg0)[arg1 >>> 0];
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_get_de6a0f7d4d18a304: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_get_unchecked_33f6e5c9e2f2d6b2: function(arg0, arg1) {
            const ret = getObject(arg0)[arg1 >>> 0];
            return addHeapObject(ret);
        },
        __wbg_gpu_2ccc250735d24a2a: function(arg0) {
            const ret = getObject(arg0).gpu;
            return addHeapObject(ret);
        },
        __wbg_has_0c97053e877f47cc: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).has(getStringFromWasm0(arg1, arg2));
            return ret;
        },
        __wbg_height_6664d43063375ca4: function(arg0) {
            const ret = getObject(arg0).height;
            return ret;
        },
        __wbg_height_ef5b5950872773b5: function(arg0) {
            const ret = getObject(arg0).height;
            return ret;
        },
        __wbg_includes_367c36d32b948d18: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).includes(getObject(arg1), arg2);
            return ret;
        },
        __wbg_info_cf0d9a286850cd24: function(arg0) {
            const ret = getObject(arg0).info;
            return addHeapObject(ret);
        },
        __wbg_instanceof_HtmlCanvasElement_8325b7578cc1684c: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof HTMLCanvasElement;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_OffscreenCanvas_e659f51cf3c8ce03: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof OffscreenCanvas;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGl2RenderingContext_39d13e3f953130c7: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGL2RenderingContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_e093be59ee9a8e14: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_invalidateFramebuffer_6b8dae55a3debb1d: function() { return handleError(function (arg0, arg1, arg2) {
            getObject(arg0).invalidateFramebuffer(arg1 >>> 0, getObject(arg2));
        }, arguments); },
        __wbg_isFallbackAdapter_8ccb967428491dcb: function(arg0) {
            const ret = getObject(arg0).isFallbackAdapter;
            return ret;
        },
        __wbg_is_4801976d24bcae5b: function(arg0, arg1) {
            const ret = Object.is(getObject(arg0), getObject(arg1));
            return ret;
        },
        __wbg_label_7ed42f25f841996b: function(arg0, arg1) {
            const ret = getObject(arg1).label;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_length_4a591ecaa01354d9: function(arg0) {
            const ret = getObject(arg0).length;
            return ret;
        },
        __wbg_length_66f1a4b2e9026940: function(arg0) {
            const ret = getObject(arg0).length;
            return ret;
        },
        __wbg_limits_20c6f56636df7d38: function(arg0) {
            const ret = getObject(arg0).limits;
            return addHeapObject(ret);
        },
        __wbg_limits_328c61cd41512420: function(arg0) {
            const ret = getObject(arg0).limits;
            return addHeapObject(ret);
        },
        __wbg_linkProgram_3ccc9beaa6dace28: function(arg0, arg1) {
            getObject(arg0).linkProgram(getObject(arg1));
        },
        __wbg_linkProgram_fe2b1bf26336c4a5: function(arg0, arg1) {
            getObject(arg0).linkProgram(getObject(arg1));
        },
        __wbg_mapAsync_52b01fa9e8f765fd: function(arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).mapAsync(arg1 >>> 0, arg2, arg3);
            return addHeapObject(ret);
        },
        __wbg_matchMedia_072e51dea8ac78bd: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).matchMedia(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_matches_2f598e82be2a8afc: function(arg0) {
            const ret = getObject(arg0).matches;
            return ret;
        },
        __wbg_maxBindGroupsPlusVertexBuffers_33e5006b23e20478: function(arg0) {
            const ret = getObject(arg0).maxBindGroupsPlusVertexBuffers;
            return ret;
        },
        __wbg_maxBindGroups_f6d26f3a67826666: function(arg0) {
            const ret = getObject(arg0).maxBindGroups;
            return ret;
        },
        __wbg_maxBindingsPerBindGroup_edab2e8dabbf6060: function(arg0) {
            const ret = getObject(arg0).maxBindingsPerBindGroup;
            return ret;
        },
        __wbg_maxBufferSize_bbc69284c14aa7da: function(arg0) {
            const ret = getObject(arg0).maxBufferSize;
            return ret;
        },
        __wbg_maxColorAttachmentBytesPerSample_63ebe4f81de2f34c: function(arg0) {
            const ret = getObject(arg0).maxColorAttachmentBytesPerSample;
            return ret;
        },
        __wbg_maxColorAttachments_aed8c38beabf3a5c: function(arg0) {
            const ret = getObject(arg0).maxColorAttachments;
            return ret;
        },
        __wbg_maxComputeInvocationsPerWorkgroup_2d964564c37f1c65: function(arg0) {
            const ret = getObject(arg0).maxComputeInvocationsPerWorkgroup;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeX_a3e3206570da184f: function(arg0) {
            const ret = getObject(arg0).maxComputeWorkgroupSizeX;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeY_dffa4a62244b7563: function(arg0) {
            const ret = getObject(arg0).maxComputeWorkgroupSizeY;
            return ret;
        },
        __wbg_maxComputeWorkgroupSizeZ_976ebcb760f6d07d: function(arg0) {
            const ret = getObject(arg0).maxComputeWorkgroupSizeZ;
            return ret;
        },
        __wbg_maxComputeWorkgroupStorageSize_2e8dbece6e532e2a: function(arg0) {
            const ret = getObject(arg0).maxComputeWorkgroupStorageSize;
            return ret;
        },
        __wbg_maxComputeWorkgroupsPerDimension_bb7d36b4d20c80f4: function(arg0) {
            const ret = getObject(arg0).maxComputeWorkgroupsPerDimension;
            return ret;
        },
        __wbg_maxDynamicStorageBuffersPerPipelineLayout_1ca859cb96a414e0: function(arg0) {
            const ret = getObject(arg0).maxDynamicStorageBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxDynamicUniformBuffersPerPipelineLayout_e968f2c8cd8f4d46: function(arg0) {
            const ret = getObject(arg0).maxDynamicUniformBuffersPerPipelineLayout;
            return ret;
        },
        __wbg_maxInterStageShaderVariables_138ac882c4d6a3d3: function(arg0) {
            const ret = getObject(arg0).maxInterStageShaderVariables;
            return ret;
        },
        __wbg_maxSampledTexturesPerShaderStage_bb3e6b2698321fa6: function(arg0) {
            const ret = getObject(arg0).maxSampledTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxSamplersPerShaderStage_98c00a1829fa414b: function(arg0) {
            const ret = getObject(arg0).maxSamplersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageBufferBindingSize_e500e31f479e669e: function(arg0) {
            const ret = getObject(arg0).maxStorageBufferBindingSize;
            return ret;
        },
        __wbg_maxStorageBuffersPerShaderStage_eb663f6d7521b6a7: function(arg0) {
            const ret = getObject(arg0).maxStorageBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxStorageTexturesPerShaderStage_bb3ad93b53e618c0: function(arg0) {
            const ret = getObject(arg0).maxStorageTexturesPerShaderStage;
            return ret;
        },
        __wbg_maxTextureArrayLayers_2a56d05fb261c99a: function(arg0) {
            const ret = getObject(arg0).maxTextureArrayLayers;
            return ret;
        },
        __wbg_maxTextureDimension1D_84590c1d4770d319: function(arg0) {
            const ret = getObject(arg0).maxTextureDimension1D;
            return ret;
        },
        __wbg_maxTextureDimension2D_7f2b5c8b2727e3fc: function(arg0) {
            const ret = getObject(arg0).maxTextureDimension2D;
            return ret;
        },
        __wbg_maxTextureDimension3D_7f3babddf55c32a6: function(arg0) {
            const ret = getObject(arg0).maxTextureDimension3D;
            return ret;
        },
        __wbg_maxUniformBufferBindingSize_d80a09e23c0b284c: function(arg0) {
            const ret = getObject(arg0).maxUniformBufferBindingSize;
            return ret;
        },
        __wbg_maxUniformBuffersPerShaderStage_0b8b2de676fa740e: function(arg0) {
            const ret = getObject(arg0).maxUniformBuffersPerShaderStage;
            return ret;
        },
        __wbg_maxVertexAttributes_a693dd921316649b: function(arg0) {
            const ret = getObject(arg0).maxVertexAttributes;
            return ret;
        },
        __wbg_maxVertexBufferArrayStride_f256d91f281076cb: function(arg0) {
            const ret = getObject(arg0).maxVertexBufferArrayStride;
            return ret;
        },
        __wbg_maxVertexBuffers_70ab564b25d5ac20: function(arg0) {
            const ret = getObject(arg0).maxVertexBuffers;
            return ret;
        },
        __wbg_minStorageBufferOffsetAlignment_3248ed00dcdbf79f: function(arg0) {
            const ret = getObject(arg0).minStorageBufferOffsetAlignment;
            return ret;
        },
        __wbg_minUniformBufferOffsetAlignment_3b9fa4caae03e903: function(arg0) {
            const ret = getObject(arg0).minUniformBufferOffsetAlignment;
            return ret;
        },
        __wbg_navigator_3833ecdbc19d2757: function(arg0) {
            const ret = getObject(arg0).navigator;
            return addHeapObject(ret);
        },
        __wbg_navigator_391291470f58c650: function(arg0) {
            const ret = getObject(arg0).navigator;
            return addHeapObject(ret);
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return addHeapObject(ret);
        },
        __wbg_new_3b242422c588a8f3: function() { return handleError(function (arg0, arg1) {
            const ret = new OffscreenCanvas(arg0 >>> 0, arg1 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_new_b682b81e8eaaf027: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return __wasm_bindgen_func_elem_14698(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return addHeapObject(ret);
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_ce1ab61c1c2b300d: function() {
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_new_d90091b82fdf5b91: function() {
            const ret = new Array();
            return addHeapObject(ret);
        },
        __wbg_new_typed_41c97238ee4583e3: function() {
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_new_typed_bf31d18f92484486: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return __wasm_bindgen_func_elem_14698(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return addHeapObject(ret);
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_byte_offset_and_length_d836f26d916dd9ad: function(arg0, arg1, arg2) {
            const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_new_with_length_36a4998e27b014c5: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_now_cace042f68c814d8: function(arg0) {
            const ret = getObject(arg0).now();
            return ret;
        },
        __wbg_of_57145fdec12d159f: function(arg0) {
            const ret = Array.of(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_onSubmittedWorkDone_270d6b5a45520e79: function(arg0) {
            const ret = getObject(arg0).onSubmittedWorkDone();
            return addHeapObject(ret);
        },
        __wbg_performance_5fc5a6563dcd33de: function(arg0) {
            const ret = getObject(arg0).performance;
            return addHeapObject(ret);
        },
        __wbg_pixelStorei_6e42d231aa75bd00: function(arg0, arg1, arg2) {
            getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
        },
        __wbg_pixelStorei_84dc1952dc699c94: function(arg0, arg1, arg2) {
            getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
        },
        __wbg_polygonOffset_9dfef3da7ad3d396: function(arg0, arg1, arg2) {
            getObject(arg0).polygonOffset(arg1, arg2);
        },
        __wbg_polygonOffset_c3e3e5bedb9aeadd: function(arg0, arg1, arg2) {
            getObject(arg0).polygonOffset(arg1, arg2);
        },
        __wbg_prototypesetcall_3249fc62a0fafa30: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
        },
        __wbg_push_a6822215aa43e71c: function(arg0, arg1) {
            const ret = getObject(arg0).push(getObject(arg1));
            return ret;
        },
        __wbg_queryCounterEXT_6e24a29e2e5a95c8: function(arg0, arg1, arg2) {
            getObject(arg0).queryCounterEXT(getObject(arg1), arg2 >>> 0);
        },
        __wbg_querySelectorAll_4dcc230a2f8a2498: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).querySelectorAll(getStringFromWasm0(arg1, arg2));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_querySelector_6f6509bf1f8f4753: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).querySelector(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_queueMicrotask_35c611f4a14830b2: function(arg0) {
            queueMicrotask(getObject(arg0));
        },
        __wbg_queueMicrotask_404ed0a58e0b63cc: function(arg0) {
            const ret = getObject(arg0).queueMicrotask;
            return addHeapObject(ret);
        },
        __wbg_queue_adce34608fd0c893: function(arg0) {
            const ret = getObject(arg0).queue;
            return addHeapObject(ret);
        },
        __wbg_readBuffer_2027f7cdd7533f2d: function(arg0, arg1) {
            getObject(arg0).readBuffer(arg1 >>> 0);
        },
        __wbg_readPixels_a04f5cf5019be695: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
            getObject(arg0).readPixels(arg1, arg2, arg3, arg4, arg5 >>> 0, arg6 >>> 0, getObject(arg7));
        }, arguments); },
        __wbg_readPixels_bf9ee726d9179d3c: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
            getObject(arg0).readPixels(arg1, arg2, arg3, arg4, arg5 >>> 0, arg6 >>> 0, getObject(arg7));
        }, arguments); },
        __wbg_readPixels_d00c1cae608273d8: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
            getObject(arg0).readPixels(arg1, arg2, arg3, arg4, arg5 >>> 0, arg6 >>> 0, arg7);
        }, arguments); },
        __wbg_reject_5cfff571450086dd: function(arg0) {
            const ret = Promise.reject(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_renderbufferStorageMultisample_75bba97a8e59bc6e: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).renderbufferStorageMultisample(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_renderbufferStorage_3f5b0ec8fca2f9f8: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).renderbufferStorage(arg1 >>> 0, arg2 >>> 0, arg3, arg4);
        },
        __wbg_renderbufferStorage_c34a47cacbbc5fff: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).renderbufferStorage(arg1 >>> 0, arg2 >>> 0, arg3, arg4);
        },
        __wbg_requestAdapter_2e6718811c735a57: function(arg0, arg1) {
            const ret = getObject(arg0).requestAdapter(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_requestDevice_ab46d0519ea1cc34: function(arg0, arg1) {
            const ret = getObject(arg0).requestDevice(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_resolveQuerySet_0f32dc3de3f09701: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).resolveQuerySet(getObject(arg1), arg2 >>> 0, arg3 >>> 0, getObject(arg4), arg5 >>> 0);
        },
        __wbg_resolve_25a7e548d5881dca: function(arg0) {
            const ret = Promise.resolve(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_samplerParameterf_86886d3fdf2214c8: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).samplerParameterf(getObject(arg1), arg2 >>> 0, arg3);
        },
        __wbg_samplerParameteri_dae56bd940ca2480: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).samplerParameteri(getObject(arg1), arg2 >>> 0, arg3);
        },
        __wbg_scissor_079b7c4a5c9fcb63: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).scissor(arg1, arg2, arg3, arg4);
        },
        __wbg_scissor_e69faa631ab6fdc0: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).scissor(arg1, arg2, arg3, arg4);
        },
        __wbg_setBindGroup_268fd1714fff0ef5: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2), getArrayU32FromWasm0(arg3, arg4), arg5, arg6 >>> 0);
        }, arguments); },
        __wbg_setBindGroup_f0de6cb2c7dbfc2c: function(arg0, arg1, arg2) {
            getObject(arg0).setBindGroup(arg1 >>> 0, getObject(arg2));
        },
        __wbg_setIndexBuffer_2531a9103450445e: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).setIndexBuffer(getObject(arg1), __wbindgen_enum_GpuIndexFormat[arg2], arg3);
        },
        __wbg_setIndexBuffer_7f3cf667b4d71566: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).setIndexBuffer(getObject(arg1), __wbindgen_enum_GpuIndexFormat[arg2], arg3, arg4);
        },
        __wbg_setPipeline_c41bf46790f27f9e: function(arg0, arg1) {
            getObject(arg0).setPipeline(getObject(arg1));
        },
        __wbg_setVertexBuffer_1e448859663dd400: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3);
        },
        __wbg_setVertexBuffer_7cf533d694e747f3: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).setVertexBuffer(arg1 >>> 0, getObject(arg2), arg3, arg4);
        },
        __wbg_set_29c99a8aac1c01e5: function(arg0, arg1, arg2) {
            getObject(arg0).set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbg_set_6e30c9374c26414c: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
            return ret;
        }, arguments); },
        __wbg_set_a_88262a42340d0b1c: function(arg0, arg1) {
            getObject(arg0).a = arg1;
        },
        __wbg_set_access_9a5092f05dc45fad: function(arg0, arg1) {
            getObject(arg0).access = __wbindgen_enum_GpuStorageTextureAccess[arg1];
        },
        __wbg_set_address_mode_u_9e2695575a219e33: function(arg0, arg1) {
            getObject(arg0).addressModeU = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_v_f479b2e6cccbcac4: function(arg0, arg1) {
            getObject(arg0).addressModeV = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_address_mode_w_46273e153230180d: function(arg0, arg1) {
            getObject(arg0).addressModeW = __wbindgen_enum_GpuAddressMode[arg1];
        },
        __wbg_set_alpha_bfd2df62e7bc581b: function(arg0, arg1) {
            getObject(arg0).alpha = getObject(arg1);
        },
        __wbg_set_alpha_mode_df805952892caa9c: function(arg0, arg1) {
            getObject(arg0).alphaMode = __wbindgen_enum_GpuCanvasAlphaMode[arg1];
        },
        __wbg_set_alpha_to_coverage_enabled_8b5dc2b0a225b3b2: function(arg0, arg1) {
            getObject(arg0).alphaToCoverageEnabled = arg1 !== 0;
        },
        __wbg_set_array_layer_count_7312f0f31af94e7c: function(arg0, arg1) {
            getObject(arg0).arrayLayerCount = arg1 >>> 0;
        },
        __wbg_set_array_stride_f64_27ffaf4fffd74e61: function(arg0, arg1) {
            getObject(arg0).arrayStride = arg1;
        },
        __wbg_set_aspect_0d453bca3d012f02: function(arg0, arg1) {
            getObject(arg0).aspect = __wbindgen_enum_GpuTextureAspect[arg1];
        },
        __wbg_set_aspect_4962514fe99e68e6: function(arg0, arg1) {
            getObject(arg0).aspect = __wbindgen_enum_GpuTextureAspect[arg1];
        },
        __wbg_set_attributes_7537844a7e6dafdc: function(arg0, arg1, arg2) {
            getObject(arg0).attributes = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_b_c47befe0af3261eb: function(arg0, arg1) {
            getObject(arg0).b = arg1;
        },
        __wbg_set_base_array_layer_f176bb9f1b37b342: function(arg0, arg1) {
            getObject(arg0).baseArrayLayer = arg1 >>> 0;
        },
        __wbg_set_base_mip_level_1df145d9f8db32a9: function(arg0, arg1) {
            getObject(arg0).baseMipLevel = arg1 >>> 0;
        },
        __wbg_set_beginning_of_pass_write_index_e9f5d016947893bd: function(arg0, arg1) {
            getObject(arg0).beginningOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_bind_group_layouts_5a9cfea401c020ab: function(arg0, arg1, arg2) {
            getObject(arg0).bindGroupLayouts = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_binding_155b0440b4307793: function(arg0, arg1) {
            getObject(arg0).binding = arg1 >>> 0;
        },
        __wbg_set_binding_f74df3510792aba1: function(arg0, arg1) {
            getObject(arg0).binding = arg1 >>> 0;
        },
        __wbg_set_blend_7493c2066c3e9970: function(arg0, arg1) {
            getObject(arg0).blend = getObject(arg1);
        },
        __wbg_set_buffer_9c01e3b6d6765ea2: function(arg0, arg1) {
            getObject(arg0).buffer = getObject(arg1);
        },
        __wbg_set_buffer_c3410572051920ba: function(arg0, arg1) {
            getObject(arg0).buffer = getObject(arg1);
        },
        __wbg_set_buffer_ef7f75306cf663ed: function(arg0, arg1) {
            getObject(arg0).buffer = getObject(arg1);
        },
        __wbg_set_buffers_7d0d8f507699e956: function(arg0, arg1, arg2) {
            getObject(arg0).buffers = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_bytes_per_row_c54ca96953f35774: function(arg0, arg1) {
            getObject(arg0).bytesPerRow = arg1 >>> 0;
        },
        __wbg_set_bytes_per_row_d69b88eee3929c07: function(arg0, arg1) {
            getObject(arg0).bytesPerRow = arg1 >>> 0;
        },
        __wbg_set_c775d84916be79ea: function(arg0, arg1, arg2) {
            getObject(arg0).set(getObject(arg1), arg2 >>> 0);
        },
        __wbg_set_clear_value_gpu_color_dict_6211425789c76e59: function(arg0, arg1) {
            getObject(arg0).clearValue = getObject(arg1);
        },
        __wbg_set_code_b4f37f81f45b5b25: function(arg0, arg1, arg2) {
            getObject(arg0).code = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_color_83aa977526e88cbb: function(arg0, arg1) {
            getObject(arg0).color = getObject(arg1);
        },
        __wbg_set_color_attachments_581fdb3310e4abfa: function(arg0, arg1, arg2) {
            getObject(arg0).colorAttachments = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_compare_cd9b62cdb92eb580: function(arg0, arg1) {
            getObject(arg0).compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_compare_f36b34abfaa08ccb: function(arg0, arg1) {
            getObject(arg0).compare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_count_069a4eac409bac55: function(arg0, arg1) {
            getObject(arg0).count = arg1 >>> 0;
        },
        __wbg_set_count_3ab1c1220e4ceeb3: function(arg0, arg1) {
            getObject(arg0).count = arg1 >>> 0;
        },
        __wbg_set_cull_mode_fc649853947a3d0c: function(arg0, arg1) {
            getObject(arg0).cullMode = __wbindgen_enum_GpuCullMode[arg1];
        },
        __wbg_set_depth_bias_clamp_1c0d695df7f092e5: function(arg0, arg1) {
            getObject(arg0).depthBiasClamp = arg1;
        },
        __wbg_set_depth_bias_d7cd16096242a657: function(arg0, arg1) {
            getObject(arg0).depthBias = arg1;
        },
        __wbg_set_depth_bias_slope_scale_c4e52ec743ef55ba: function(arg0, arg1) {
            getObject(arg0).depthBiasSlopeScale = arg1;
        },
        __wbg_set_depth_clear_value_beda3ec5b1a5c43a: function(arg0, arg1) {
            getObject(arg0).depthClearValue = arg1;
        },
        __wbg_set_depth_compare_0c8631eb2eae98e3: function(arg0, arg1) {
            getObject(arg0).depthCompare = __wbindgen_enum_GpuCompareFunction[arg1];
        },
        __wbg_set_depth_fail_op_668155ae33d3c06f: function(arg0, arg1) {
            getObject(arg0).depthFailOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_depth_load_op_511c513eab4e56a9: function(arg0, arg1) {
            getObject(arg0).depthLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_depth_or_array_layers_89371305ed0bd962: function(arg0, arg1) {
            getObject(arg0).depthOrArrayLayers = arg1 >>> 0;
        },
        __wbg_set_depth_read_only_7f41a74741c144ec: function(arg0, arg1) {
            getObject(arg0).depthReadOnly = arg1 !== 0;
        },
        __wbg_set_depth_stencil_97506c7bea4f53da: function(arg0, arg1) {
            getObject(arg0).depthStencil = getObject(arg1);
        },
        __wbg_set_depth_stencil_attachment_73b79e8b4e948222: function(arg0, arg1) {
            getObject(arg0).depthStencilAttachment = getObject(arg1);
        },
        __wbg_set_depth_store_op_c89f33b39b43361c: function(arg0, arg1) {
            getObject(arg0).depthStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_depth_write_enabled_ce89750042940350: function(arg0, arg1) {
            getObject(arg0).depthWriteEnabled = arg1 !== 0;
        },
        __wbg_set_device_e275d1d4f3c9eb74: function(arg0, arg1) {
            getObject(arg0).device = getObject(arg1);
        },
        __wbg_set_dimension_868eee80f4b90011: function(arg0, arg1) {
            getObject(arg0).dimension = __wbindgen_enum_GpuTextureDimension[arg1];
        },
        __wbg_set_dimension_e325282e613ca0a4: function(arg0, arg1) {
            getObject(arg0).dimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_dst_factor_ec7407f19be1aff9: function(arg0, arg1) {
            getObject(arg0).dstFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_end_of_pass_write_index_0d546e46b86ea069: function(arg0, arg1) {
            getObject(arg0).endOfPassWriteIndex = arg1 >>> 0;
        },
        __wbg_set_entries_86a29dd6291c95e7: function(arg0, arg1, arg2) {
            getObject(arg0).entries = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_entries_a12aca1e458b0456: function(arg0, arg1, arg2) {
            getObject(arg0).entries = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_207540f042015ce5: function(arg0, arg1, arg2) {
            getObject(arg0).entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_entry_point_e87e79251dd3144f: function(arg0, arg1, arg2) {
            getObject(arg0).entryPoint = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_external_texture_386483d8dd82ab56: function(arg0, arg1) {
            getObject(arg0).externalTexture = getObject(arg1);
        },
        __wbg_set_fail_op_92f716dbc88b6973: function(arg0, arg1) {
            getObject(arg0).failOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_format_1fcaa7d60546b490: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_2c1414a817c213f8: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_533f9ffa7eef563d: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_5d2f25cc93654ecc: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuVertexFormat[arg1];
        },
        __wbg_set_format_5ff53724ed6cedf2: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_815efd4dc4817bbb: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_format_e52bdcca880d2c8e: function(arg0, arg1) {
            getObject(arg0).format = __wbindgen_enum_GpuTextureFormat[arg1];
        },
        __wbg_set_fragment_8b780f00a0b0e6f3: function(arg0, arg1) {
            getObject(arg0).fragment = getObject(arg1);
        },
        __wbg_set_front_face_28ffdf524eedce5b: function(arg0, arg1) {
            getObject(arg0).frontFace = __wbindgen_enum_GpuFrontFace[arg1];
        },
        __wbg_set_g_5983abfc46e0cf4e: function(arg0, arg1) {
            getObject(arg0).g = arg1;
        },
        __wbg_set_has_dynamic_offset_62bc230bdb7c54d0: function(arg0, arg1) {
            getObject(arg0).hasDynamicOffset = arg1 !== 0;
        },
        __wbg_set_height_0739170de8653cc4: function(arg0, arg1) {
            getObject(arg0).height = arg1 >>> 0;
        },
        __wbg_set_height_14335c4047cf9c1b: function(arg0, arg1) {
            getObject(arg0).height = arg1 >>> 0;
        },
        __wbg_set_height_c661af0c0b5376f9: function(arg0, arg1) {
            getObject(arg0).height = arg1 >>> 0;
        },
        __wbg_set_label_08d9be3e4719c226: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_17eb9fe3a02f62b0: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_206558c8adc3780f: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_48e6b787d256f621: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_547d0d4aec39fbe9: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_5ee7427342869829: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_60ad96c811e0d109: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_72bb4f41ef0cb893: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_79387decda299036: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_9556af8b5cda3c9d: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_d010f237b26f2c55: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e16e2dbe51349c7f: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e3944e54881b8c50: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_label_e922700240417ab5: function(arg0, arg1, arg2) {
            getObject(arg0).label = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_layout_50ab727f44b38f26: function(arg0, arg1) {
            getObject(arg0).layout = getObject(arg1);
        },
        __wbg_set_layout_913d53c17194c989: function(arg0, arg1) {
            getObject(arg0).layout = getObject(arg1);
        },
        __wbg_set_layout_gpu_auto_layout_mode_aeba193938b47882: function(arg0, arg1) {
            getObject(arg0).layout = __wbindgen_enum_GpuAutoLayoutMode[arg1];
        },
        __wbg_set_load_op_99661da6c4eab9b0: function(arg0, arg1) {
            getObject(arg0).loadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_lod_max_clamp_dd2d9f9f052f4f44: function(arg0, arg1) {
            getObject(arg0).lodMaxClamp = arg1;
        },
        __wbg_set_lod_min_clamp_6d20c97916baeb93: function(arg0, arg1) {
            getObject(arg0).lodMinClamp = arg1;
        },
        __wbg_set_mag_filter_b5adebc99cb938e1: function(arg0, arg1) {
            getObject(arg0).magFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mapped_at_creation_81b586dc90a50347: function(arg0, arg1) {
            getObject(arg0).mappedAtCreation = arg1 !== 0;
        },
        __wbg_set_mask_70a8a59ce09e5997: function(arg0, arg1) {
            getObject(arg0).mask = arg1 >>> 0;
        },
        __wbg_set_max_anisotropy_2beada0e2db62c45: function(arg0, arg1) {
            getObject(arg0).maxAnisotropy = arg1;
        },
        __wbg_set_min_binding_size_f64_5005a6904cdf43da: function(arg0, arg1) {
            getObject(arg0).minBindingSize = arg1;
        },
        __wbg_set_min_filter_c72f17375e135f0a: function(arg0, arg1) {
            getObject(arg0).minFilter = __wbindgen_enum_GpuFilterMode[arg1];
        },
        __wbg_set_mip_level_count_534caaa7e68e68b8: function(arg0, arg1) {
            getObject(arg0).mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mip_level_count_776c8c218b65bc08: function(arg0, arg1) {
            getObject(arg0).mipLevelCount = arg1 >>> 0;
        },
        __wbg_set_mip_level_f7ac79e8c54f59ad: function(arg0, arg1) {
            getObject(arg0).mipLevel = arg1 >>> 0;
        },
        __wbg_set_mipmap_filter_5bf66195a3639700: function(arg0, arg1) {
            getObject(arg0).mipmapFilter = __wbindgen_enum_GpuMipmapFilterMode[arg1];
        },
        __wbg_set_mode_9990b3393ba469ae: function(arg0, arg1) {
            getObject(arg0).mode = __wbindgen_enum_GpuCanvasToneMappingMode[arg1];
        },
        __wbg_set_module_d0e2098713606cae: function(arg0, arg1) {
            getObject(arg0).module = getObject(arg1);
        },
        __wbg_set_module_f02e076ca7e7daf8: function(arg0, arg1) {
            getObject(arg0).module = getObject(arg1);
        },
        __wbg_set_multisample_37ddafe88b5cd466: function(arg0, arg1) {
            getObject(arg0).multisample = getObject(arg1);
        },
        __wbg_set_multisampled_7913fd7183272840: function(arg0, arg1) {
            getObject(arg0).multisampled = arg1 !== 0;
        },
        __wbg_set_offset_f64_28c24dc15000932e: function(arg0, arg1) {
            getObject(arg0).offset = arg1;
        },
        __wbg_set_offset_f64_89f0ce01a689839e: function(arg0, arg1) {
            getObject(arg0).offset = arg1;
        },
        __wbg_set_offset_f64_b562d1367e34ef93: function(arg0, arg1) {
            getObject(arg0).offset = arg1;
        },
        __wbg_set_offset_f64_fa66068813376ca3: function(arg0, arg1) {
            getObject(arg0).offset = arg1;
        },
        __wbg_set_operation_62ce44e1728c4047: function(arg0, arg1) {
            getObject(arg0).operation = __wbindgen_enum_GpuBlendOperation[arg1];
        },
        __wbg_set_origin_gpu_origin_3d_dict_631c04520718091f: function(arg0, arg1) {
            getObject(arg0).origin = getObject(arg1);
        },
        __wbg_set_pass_op_cf02fa088d6352a7: function(arg0, arg1) {
            getObject(arg0).passOp = __wbindgen_enum_GpuStencilOperation[arg1];
        },
        __wbg_set_power_preference_8fdca0b7af640d49: function(arg0, arg1) {
            getObject(arg0).powerPreference = __wbindgen_enum_GpuPowerPreference[arg1];
        },
        __wbg_set_primitive_43c23761a55b4088: function(arg0, arg1) {
            getObject(arg0).primitive = getObject(arg1);
        },
        __wbg_set_query_set_41de86d2401aee04: function(arg0, arg1) {
            getObject(arg0).querySet = getObject(arg1);
        },
        __wbg_set_r_c6f4c68f4804d655: function(arg0, arg1) {
            getObject(arg0).r = arg1;
        },
        __wbg_set_required_features_1baf274a8669db60: function(arg0, arg1, arg2) {
            getObject(arg0).requiredFeatures = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_required_limits_871ed33c68613dcb: function(arg0, arg1) {
            getObject(arg0).requiredLimits = getObject(arg1);
        },
        __wbg_set_resolve_target_gpu_texture_view_b19a4f2debf79b96: function(arg0, arg1) {
            getObject(arg0).resolveTarget = getObject(arg1);
        },
        __wbg_set_resource_5ae7b5e67924f234: function(arg0, arg1) {
            getObject(arg0).resource = getObject(arg1);
        },
        __wbg_set_resource_gpu_buffer_binding_e5dbca063e7cb67b: function(arg0, arg1) {
            getObject(arg0).resource = getObject(arg1);
        },
        __wbg_set_resource_gpu_texture_view_eb46c355d51ad7e5: function(arg0, arg1) {
            getObject(arg0).resource = getObject(arg1);
        },
        __wbg_set_rows_per_image_5011f97318ee71af: function(arg0, arg1) {
            getObject(arg0).rowsPerImage = arg1 >>> 0;
        },
        __wbg_set_rows_per_image_59a813ac5006e10e: function(arg0, arg1) {
            getObject(arg0).rowsPerImage = arg1 >>> 0;
        },
        __wbg_set_sample_count_eb86a8b18545b54f: function(arg0, arg1) {
            getObject(arg0).sampleCount = arg1 >>> 0;
        },
        __wbg_set_sample_type_c32e1dfff94e63eb: function(arg0, arg1) {
            getObject(arg0).sampleType = __wbindgen_enum_GpuTextureSampleType[arg1];
        },
        __wbg_set_sampler_c0e1258543a33bce: function(arg0, arg1) {
            getObject(arg0).sampler = getObject(arg1);
        },
        __wbg_set_shader_location_7e1832a74f912217: function(arg0, arg1) {
            getObject(arg0).shaderLocation = arg1 >>> 0;
        },
        __wbg_set_size_f64_6bcd40704bf4cfdc: function(arg0, arg1) {
            getObject(arg0).size = arg1;
        },
        __wbg_set_size_f64_8b8f6bba5d678162: function(arg0, arg1) {
            getObject(arg0).size = arg1;
        },
        __wbg_set_size_gpu_extent_3d_dict_7e42e1c98fa36434: function(arg0, arg1) {
            getObject(arg0).size = getObject(arg1);
        },
        __wbg_set_src_factor_9bfe84af9b7b5cac: function(arg0, arg1) {
            getObject(arg0).srcFactor = __wbindgen_enum_GpuBlendFactor[arg1];
        },
        __wbg_set_stencil_back_85b22f1db5b1940a: function(arg0, arg1) {
            getObject(arg0).stencilBack = getObject(arg1);
        },
        __wbg_set_stencil_clear_value_42be608809151e2a: function(arg0, arg1) {
            getObject(arg0).stencilClearValue = arg1 >>> 0;
        },
        __wbg_set_stencil_front_525526164a798a44: function(arg0, arg1) {
            getObject(arg0).stencilFront = getObject(arg1);
        },
        __wbg_set_stencil_load_op_31838c036993098a: function(arg0, arg1) {
            getObject(arg0).stencilLoadOp = __wbindgen_enum_GpuLoadOp[arg1];
        },
        __wbg_set_stencil_read_mask_5cc26495e8b3ae82: function(arg0, arg1) {
            getObject(arg0).stencilReadMask = arg1 >>> 0;
        },
        __wbg_set_stencil_read_only_bf1d0c1897e25c62: function(arg0, arg1) {
            getObject(arg0).stencilReadOnly = arg1 !== 0;
        },
        __wbg_set_stencil_store_op_e6be1cbc3a8fc210: function(arg0, arg1) {
            getObject(arg0).stencilStoreOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_stencil_write_mask_d9cb40ec4b4bee5b: function(arg0, arg1) {
            getObject(arg0).stencilWriteMask = arg1 >>> 0;
        },
        __wbg_set_step_mode_a97bb24714da41a9: function(arg0, arg1) {
            getObject(arg0).stepMode = __wbindgen_enum_GpuVertexStepMode[arg1];
        },
        __wbg_set_storage_texture_939a097db4b18bd4: function(arg0, arg1) {
            getObject(arg0).storageTexture = getObject(arg1);
        },
        __wbg_set_store_op_b5fdf672436f13f3: function(arg0, arg1) {
            getObject(arg0).storeOp = __wbindgen_enum_GpuStoreOp[arg1];
        },
        __wbg_set_strip_index_format_9f787be6c5fc9e87: function(arg0, arg1) {
            getObject(arg0).stripIndexFormat = __wbindgen_enum_GpuIndexFormat[arg1];
        },
        __wbg_set_targets_c38bd200c836d66f: function(arg0, arg1, arg2) {
            getObject(arg0).targets = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_texture_1f64653a5d2d7b4d: function(arg0, arg1) {
            getObject(arg0).texture = getObject(arg1);
        },
        __wbg_set_texture_9dcedde1bb31eda6: function(arg0, arg1) {
            getObject(arg0).texture = getObject(arg1);
        },
        __wbg_set_timestamp_writes_98bed1a8bbc6682d: function(arg0, arg1) {
            getObject(arg0).timestampWrites = getObject(arg1);
        },
        __wbg_set_tone_mapping_b3464f1baa4cff92: function(arg0, arg1) {
            getObject(arg0).toneMapping = getObject(arg1);
        },
        __wbg_set_topology_da25f2cc5af203d2: function(arg0, arg1) {
            getObject(arg0).topology = __wbindgen_enum_GpuPrimitiveTopology[arg1];
        },
        __wbg_set_type_7f0457c6084dde9b: function(arg0, arg1) {
            getObject(arg0).type = __wbindgen_enum_GpuQueryType[arg1];
        },
        __wbg_set_type_ccf8472d40abcddf: function(arg0, arg1) {
            getObject(arg0).type = __wbindgen_enum_GpuSamplerBindingType[arg1];
        },
        __wbg_set_type_d09829f59932a0fc: function(arg0, arg1) {
            getObject(arg0).type = __wbindgen_enum_GpuBufferBindingType[arg1];
        },
        __wbg_set_unclipped_depth_04524a2b44e1e3c1: function(arg0, arg1) {
            getObject(arg0).unclippedDepth = arg1 !== 0;
        },
        __wbg_set_usage_a137f82ca163b0a9: function(arg0, arg1) {
            getObject(arg0).usage = arg1 >>> 0;
        },
        __wbg_set_usage_b2a2935f37bf3d08: function(arg0, arg1) {
            getObject(arg0).usage = arg1 >>> 0;
        },
        __wbg_set_usage_ba5b0f8b333ab325: function(arg0, arg1) {
            getObject(arg0).usage = arg1 >>> 0;
        },
        __wbg_set_usage_ddd42599bbba7779: function(arg0, arg1) {
            getObject(arg0).usage = arg1 >>> 0;
        },
        __wbg_set_vertex_0be5d146f9ff6f36: function(arg0, arg1) {
            getObject(arg0).vertex = getObject(arg1);
        },
        __wbg_set_view_dimension_0df554032f1f3a85: function(arg0, arg1) {
            getObject(arg0).viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_dimension_4818d4c18ce5815e: function(arg0, arg1) {
            getObject(arg0).viewDimension = __wbindgen_enum_GpuTextureViewDimension[arg1];
        },
        __wbg_set_view_formats_4347dc8363331086: function(arg0, arg1, arg2) {
            getObject(arg0).viewFormats = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_view_formats_5797d2fff3c11808: function(arg0, arg1, arg2) {
            getObject(arg0).viewFormats = getArrayJsValueViewFromWasm0(arg1, arg2);
        },
        __wbg_set_view_gpu_texture_view_9b2d86b6b99d9fd9: function(arg0, arg1) {
            getObject(arg0).view = getObject(arg1);
        },
        __wbg_set_view_gpu_texture_view_c0f35f8857c25206: function(arg0, arg1) {
            getObject(arg0).view = getObject(arg1);
        },
        __wbg_set_visibility_9570b037224c4cc2: function(arg0, arg1) {
            getObject(arg0).visibility = arg1 >>> 0;
        },
        __wbg_set_width_7ca43f32db1cfe8e: function(arg0, arg1) {
            getObject(arg0).width = arg1 >>> 0;
        },
        __wbg_set_width_87301412247f3343: function(arg0, arg1) {
            getObject(arg0).width = arg1 >>> 0;
        },
        __wbg_set_width_9f685402c2cbee70: function(arg0, arg1) {
            getObject(arg0).width = arg1 >>> 0;
        },
        __wbg_set_write_mask_d45279e56abbfcb5: function(arg0, arg1) {
            getObject(arg0).writeMask = arg1 >>> 0;
        },
        __wbg_set_x_876d592971db129a: function(arg0, arg1) {
            getObject(arg0).x = arg1 >>> 0;
        },
        __wbg_set_y_2b1f5ac0dd5586a5: function(arg0, arg1) {
            getObject(arg0).y = arg1 >>> 0;
        },
        __wbg_set_z_ef005d82bc9d24e3: function(arg0, arg1) {
            getObject(arg0).z = arg1 >>> 0;
        },
        __wbg_shaderSource_7d18b5a43a504f5c: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).shaderSource(getObject(arg1), getStringFromWasm0(arg2, arg3));
        },
        __wbg_shaderSource_df5bb6320451f3cd: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).shaderSource(getObject(arg1), getStringFromWasm0(arg2, arg3));
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = getObject(arg1).stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_9d53f2689e622ca1: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_a1a35cec07001a8a: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_SELF_4c59f6c7ea29a144: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_WINDOW_e70ae9f2eb052253: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_stencilFuncSeparate_371f60fafd5fb4ae: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3, arg4 >>> 0);
        },
        __wbg_stencilFuncSeparate_8256d4eaab8bca06: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3, arg4 >>> 0);
        },
        __wbg_stencilMaskSeparate_0fc04dd4cc6fb66b: function(arg0, arg1, arg2) {
            getObject(arg0).stencilMaskSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_stencilMaskSeparate_c38687587a85913c: function(arg0, arg1, arg2) {
            getObject(arg0).stencilMaskSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_stencilMask_0253e808aafcc405: function(arg0, arg1) {
            getObject(arg0).stencilMask(arg1 >>> 0);
        },
        __wbg_stencilMask_2367bd8de97d1e66: function(arg0, arg1) {
            getObject(arg0).stencilMask(arg1 >>> 0);
        },
        __wbg_stencilOpSeparate_525e89f6df581cd8: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilOpSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_stencilOpSeparate_da106e6757f93b09: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilOpSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_subgroupMaxSize_1527c5f7a8fe91bb: function(arg0) {
            const ret = getObject(arg0).subgroupMaxSize;
            return ret;
        },
        __wbg_subgroupMinSize_d6c5ad4bddc828e9: function(arg0) {
            const ret = getObject(arg0).subgroupMinSize;
            return ret;
        },
        __wbg_submit_ce44115121cd166c: function(arg0, arg1, arg2) {
            getObject(arg0).submit(getArrayJsValueViewFromWasm0(arg1, arg2));
        },
        __wbg_texImage2D_152e9dcd4bc3a464: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texImage2D_3704db20a16b6c35: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texImage2D_ea94e8a2df5f97e2: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, arg9);
        }, arguments); },
        __wbg_texImage3D_3260b334a8aa45fc: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
            getObject(arg0).texImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8 >>> 0, arg9 >>> 0, arg10);
        }, arguments); },
        __wbg_texImage3D_b023d424e0761998: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
            getObject(arg0).texImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8 >>> 0, arg9 >>> 0, getObject(arg10));
        }, arguments); },
        __wbg_texParameteri_87ebfcefb0af2c50: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
        },
        __wbg_texParameteri_e5ad2054e239066e: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
        },
        __wbg_texStorage2D_bb2a1bd1ab0b9184: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).texStorage2D(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_texStorage3D_04e5dfdf5bfff306: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).texStorage3D(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5, arg6);
        },
        __wbg_texSubImage2D_1ee177dd10ece412: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_3d72b1b395b5cc42: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_4ca4c3faa4392438: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_54d18572b1ba74ab: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, arg9);
        }, arguments); },
        __wbg_texSubImage2D_5bebe93724e6ed61: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_5f85b200d968a396: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_9d9b1945029ce3d4: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage2D_b486a62e224d24da: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
            getObject(arg0).texSubImage2D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7 >>> 0, arg8 >>> 0, getObject(arg9));
        }, arguments); },
        __wbg_texSubImage3D_49fb367a72bdf05a: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_texSubImage3D_88a95891ec5a6b7d: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, arg11);
        }, arguments); },
        __wbg_texSubImage3D_8f298b790c113d73: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_texSubImage3D_a3076ad11e18ee8c: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_texSubImage3D_a40a6d5cc46ea451: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_texSubImage3D_ba95e7575a7ed6ea: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_texSubImage3D_fa3bf017d3f460a8: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10, arg11) {
            getObject(arg0).texSubImage3D(arg1 >>> 0, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9 >>> 0, arg10 >>> 0, getObject(arg11));
        }, arguments); },
        __wbg_then_18f476d590e58992: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        },
        __wbg_then_ac7b025999b52837: function(arg0, arg1) {
            const ret = getObject(arg0).then(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_unconfigure_0a07a0a40de8988d: function(arg0) {
            getObject(arg0).unconfigure();
        },
        __wbg_uniform1f_8c3b3e6e3723fe14: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1f(getObject(arg1), arg2);
        },
        __wbg_uniform1f_d6619faa73c2a45f: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1f(getObject(arg1), arg2);
        },
        __wbg_uniform1i_14982bb8438243b4: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1i(getObject(arg1), arg2);
        },
        __wbg_uniform1i_cf11d5b364eed1c8: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1i(getObject(arg1), arg2);
        },
        __wbg_uniform1ui_d177882f473d2afc: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1ui(getObject(arg1), arg2 >>> 0);
        },
        __wbg_uniform2fv_2f06d989ec4b5d8f: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform2fv_f022309b362a80c3: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform2iv_299a133442b7645e: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform2iv_458889e37ef52ddb: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform2uiv_bbd88ee14c3070e4: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2uiv(getObject(arg1), getArrayU32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3fv_aae091d1ab84a0f7: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3fv_b73ec763397adc28: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3iv_7adea93d175d92c4: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3iv_e96fb1f4ef6cb5e9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3uiv_5c04de40b932d69c: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3uiv(getObject(arg1), getArrayU32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4f_f1a670d511b34878: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
        },
        __wbg_uniform4f_f97f3f59af09856f: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
        },
        __wbg_uniform4fv_23c498fb9de80175: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4fv_894a2198afef095c: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4iv_4878a9ee655f96e2: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4iv_4c71ad52f16b44ca: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4uiv_f85035e7193a43bb: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4uiv(getObject(arg1), getArrayU32FromWasm0(arg2, arg3));
        },
        __wbg_uniformBlockBinding_66e98eb5f26edbb3: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniformBlockBinding(getObject(arg1), arg2 >>> 0, arg3 >>> 0);
        },
        __wbg_uniformMatrix2fv_57de3f26c82ca644: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix2fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix2fv_6a952b1bd6919b5d: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix2fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix2x3fv_4599032e81252fab: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix2x3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix2x4fv_1b88e655bc18f2b4: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix2x4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix3fv_f45b91f173d7fbed: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix3fv_feab3f952d705f51: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix3x2fv_ab13f9742e5fcb2f: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix3x2fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix3x4fv_549ae6ece1479b49: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix3x4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix4fv_540dc6bf792eba8f: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix4fv_e3dac9dd429d6adc: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix4x2fv_9d20a3c69862f73f: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix4x2fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix4x3fv_115d029ad3124cef: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix4x3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_unmap_adaf93276fdf9aaf: function(arg0) {
            getObject(arg0).unmap();
        },
        __wbg_useProgram_55a3e940abb19137: function(arg0, arg1) {
            getObject(arg0).useProgram(getObject(arg1));
        },
        __wbg_useProgram_e24dadf4c06636f5: function(arg0, arg1) {
            getObject(arg0).useProgram(getObject(arg1));
        },
        __wbg_vertexAttribDivisorANGLE_829ccd7750e4ae27: function(arg0, arg1, arg2) {
            getObject(arg0).vertexAttribDivisorANGLE(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_vertexAttribDivisor_0c3e380a6eb4cc60: function(arg0, arg1, arg2) {
            getObject(arg0).vertexAttribDivisor(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_vertexAttribIPointer_ed1c3507e84527e2: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).vertexAttribIPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_vertexAttribPointer_39eddea7c20e350c: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).vertexAttribPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4 !== 0, arg5, arg6);
        },
        __wbg_vertexAttribPointer_3bc50c0431082f73: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).vertexAttribPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4 !== 0, arg5, arg6);
        },
        __wbg_viewport_14d947f2faf58e85: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).viewport(arg1, arg2, arg3, arg4);
        },
        __wbg_viewport_24055b0754803788: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).viewport(arg1, arg2, arg3, arg4);
        },
        __wbg_webrenderer_new: function(arg0) {
            const ret = WebRenderer.__wrap(arg0);
            return addHeapObject(ret);
        },
        __wbg_width_440db126d7331632: function(arg0) {
            const ret = getObject(arg0).width;
            return ret;
        },
        __wbg_width_796e38875beab5e6: function(arg0) {
            const ret = getObject(arg0).width;
            return ret;
        },
        __wbg_writeBuffer_8b5bd251a89198bc: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).writeBuffer(getObject(arg1), arg2, getArrayU8FromWasm0(arg3, arg4), arg5, arg6);
        }, arguments); },
        __wbg_writeTexture_53ba204c494b042c: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).writeTexture(getObject(arg1), getArrayU8FromWasm0(arg2, arg3), getObject(arg4), getObject(arg5));
        }, arguments); },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 1958, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_14696);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("GPUDevice")], shim_idx: 254, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_5036);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("any")], shim_idx: 254, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_5036_2);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("undefined")], shim_idx: 254, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_5036_3);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000005: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000006: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(F32)) -> NamedExternref("Float32Array")`.
            const ret = getArrayF32FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000007: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(I16)) -> NamedExternref("Int16Array")`.
            const ret = getArrayI16FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000008: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(I32)) -> NamedExternref("Int32Array")`.
            const ret = getArrayI32FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000009: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(I8)) -> NamedExternref("Int8Array")`.
            const ret = getArrayI8FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_000000000000000a: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U16)) -> NamedExternref("Uint16Array")`.
            const ret = getArrayU16FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_000000000000000b: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U32)) -> NamedExternref("Uint32Array")`.
            const ret = getArrayU32FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_000000000000000c: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_cast_000000000000000d: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_clone_ref: function(arg0) {
            const ret = getObject(arg0);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./threers_bg.js": import0,
    };
}

function __wasm_bindgen_func_elem_14696(arg0, arg1, arg2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.__wasm_bindgen_func_elem_14696(retptr, arg0, arg1, addHeapObject(arg2));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function __wasm_bindgen_func_elem_5036(arg0, arg1, arg2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.__wasm_bindgen_func_elem_5036(retptr, arg0, arg1, addHeapObject(arg2));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function __wasm_bindgen_func_elem_5036_2(arg0, arg1, arg2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.__wasm_bindgen_func_elem_5036_2(retptr, arg0, arg1, addHeapObject(arg2));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function __wasm_bindgen_func_elem_5036_3(arg0, arg1, arg2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.__wasm_bindgen_func_elem_5036_3(retptr, arg0, arg1, addHeapObject(arg2));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function __wasm_bindgen_func_elem_14698(arg0, arg1, arg2, arg3) {
    wasm.__wasm_bindgen_func_elem_14698(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}


const __wbindgen_enum_GpuAddressMode = ["clamp-to-edge", "repeat", "mirror-repeat"];


const __wbindgen_enum_GpuAutoLayoutMode = ["auto"];


const __wbindgen_enum_GpuBlendFactor = ["zero", "one", "src", "one-minus-src", "src-alpha", "one-minus-src-alpha", "dst", "one-minus-dst", "dst-alpha", "one-minus-dst-alpha", "src-alpha-saturated", "constant", "one-minus-constant", "src1", "one-minus-src1", "src1-alpha", "one-minus-src1-alpha"];


const __wbindgen_enum_GpuBlendOperation = ["add", "subtract", "reverse-subtract", "min", "max"];


const __wbindgen_enum_GpuBufferBindingType = ["uniform", "storage", "read-only-storage"];


const __wbindgen_enum_GpuCanvasAlphaMode = ["opaque", "premultiplied"];


const __wbindgen_enum_GpuCanvasToneMappingMode = ["standard", "extended"];


const __wbindgen_enum_GpuCompareFunction = ["never", "less", "equal", "less-equal", "greater", "not-equal", "greater-equal", "always"];


const __wbindgen_enum_GpuCullMode = ["none", "front", "back"];


const __wbindgen_enum_GpuFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuFrontFace = ["ccw", "cw"];


const __wbindgen_enum_GpuIndexFormat = ["uint16", "uint32"];


const __wbindgen_enum_GpuLoadOp = ["load", "clear"];


const __wbindgen_enum_GpuMipmapFilterMode = ["nearest", "linear"];


const __wbindgen_enum_GpuPowerPreference = ["low-power", "high-performance"];


const __wbindgen_enum_GpuPrimitiveTopology = ["point-list", "line-list", "line-strip", "triangle-list", "triangle-strip"];


const __wbindgen_enum_GpuQueryType = ["occlusion", "timestamp"];


const __wbindgen_enum_GpuSamplerBindingType = ["filtering", "non-filtering", "comparison"];


const __wbindgen_enum_GpuStencilOperation = ["keep", "zero", "replace", "invert", "increment-clamp", "decrement-clamp", "increment-wrap", "decrement-wrap"];


const __wbindgen_enum_GpuStorageTextureAccess = ["write-only", "read-only", "read-write"];


const __wbindgen_enum_GpuStoreOp = ["store", "discard"];


const __wbindgen_enum_GpuTextureAspect = ["all", "stencil-only", "depth-only"];


const __wbindgen_enum_GpuTextureDimension = ["1d", "2d", "3d"];


const __wbindgen_enum_GpuTextureFormat = ["r8unorm", "r8snorm", "r8uint", "r8sint", "r16unorm", "r16snorm", "r16uint", "r16sint", "r16float", "rg8unorm", "rg8snorm", "rg8uint", "rg8sint", "r32uint", "r32sint", "r32float", "rg16unorm", "rg16snorm", "rg16uint", "rg16sint", "rg16float", "rgba8unorm", "rgba8unorm-srgb", "rgba8snorm", "rgba8uint", "rgba8sint", "bgra8unorm", "bgra8unorm-srgb", "rgb9e5ufloat", "rgb10a2uint", "rgb10a2unorm", "rg11b10ufloat", "rg32uint", "rg32sint", "rg32float", "rgba16unorm", "rgba16snorm", "rgba16uint", "rgba16sint", "rgba16float", "rgba32uint", "rgba32sint", "rgba32float", "stencil8", "depth16unorm", "depth24plus", "depth24plus-stencil8", "depth32float", "depth32float-stencil8", "bc1-rgba-unorm", "bc1-rgba-unorm-srgb", "bc2-rgba-unorm", "bc2-rgba-unorm-srgb", "bc3-rgba-unorm", "bc3-rgba-unorm-srgb", "bc4-r-unorm", "bc4-r-snorm", "bc5-rg-unorm", "bc5-rg-snorm", "bc6h-rgb-ufloat", "bc6h-rgb-float", "bc7-rgba-unorm", "bc7-rgba-unorm-srgb", "etc2-rgb8unorm", "etc2-rgb8unorm-srgb", "etc2-rgb8a1unorm", "etc2-rgb8a1unorm-srgb", "etc2-rgba8unorm", "etc2-rgba8unorm-srgb", "eac-r11unorm", "eac-r11snorm", "eac-rg11unorm", "eac-rg11snorm", "astc-4x4-unorm", "astc-4x4-unorm-srgb", "astc-5x4-unorm", "astc-5x4-unorm-srgb", "astc-5x5-unorm", "astc-5x5-unorm-srgb", "astc-6x5-unorm", "astc-6x5-unorm-srgb", "astc-6x6-unorm", "astc-6x6-unorm-srgb", "astc-8x5-unorm", "astc-8x5-unorm-srgb", "astc-8x6-unorm", "astc-8x6-unorm-srgb", "astc-8x8-unorm", "astc-8x8-unorm-srgb", "astc-10x5-unorm", "astc-10x5-unorm-srgb", "astc-10x6-unorm", "astc-10x6-unorm-srgb", "astc-10x8-unorm", "astc-10x8-unorm-srgb", "astc-10x10-unorm", "astc-10x10-unorm-srgb", "astc-12x10-unorm", "astc-12x10-unorm-srgb", "astc-12x12-unorm", "astc-12x12-unorm-srgb"];


const __wbindgen_enum_GpuTextureSampleType = ["float", "unfilterable-float", "depth", "sint", "uint"];


const __wbindgen_enum_GpuTextureViewDimension = ["1d", "2d", "2d-array", "cube", "cube-array", "3d"];


const __wbindgen_enum_GpuVertexFormat = ["uint8", "uint8x2", "uint8x4", "sint8", "sint8x2", "sint8x4", "unorm8", "unorm8x2", "unorm8x4", "snorm8", "snorm8x2", "snorm8x4", "uint16", "uint16x2", "uint16x4", "sint16", "sint16x2", "sint16x4", "unorm16", "unorm16x2", "unorm16x4", "snorm16", "snorm16x2", "snorm16x4", "float16", "float16x2", "float16x4", "float32", "float32x2", "float32x3", "float32x4", "uint32", "uint32x2", "uint32x3", "uint32x4", "sint32", "sint32x2", "sint32x3", "sint32x4", "unorm10-10-10-2", "unorm8x4-bgra"];


const __wbindgen_enum_GpuVertexStepMode = ["vertex", "instance"];
const WebAlembicLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webalembicloader_free(ptr, 1));
const WebAnimationClipFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webanimationclip_free(ptr, 1));
const WebAnimationMixerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webanimationmixer_free(ptr, 1));
const WebArcballControlsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webarcballcontrols_free(ptr, 1));
const WebAudioFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webaudio_free(ptr, 1));
const WebAudioListenerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webaudiolistener_free(ptr, 1));
const WebAxesHelperFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webaxeshelper_free(ptr, 1));
const WebBloomPassFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webbloompass_free(ptr, 1));
const WebBox2Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webbox2_free(ptr, 1));
const WebBox3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webbox3_free(ptr, 1));
const WebBoxHelperFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webboxhelper_free(ptr, 1));
const WebBufferAttributeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webbufferattribute_free(ptr, 1));
const WebBufferGeometryFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webbuffergeometry_free(ptr, 1));
const WebCameraFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcamera_free(ptr, 1));
const WebCatmullRomCurve3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcatmullromcurve3_free(ptr, 1));
const WebClockFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webclock_free(ptr, 1));
const WebColladaLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcolladaloader_free(ptr, 1));
const WebColorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcolor_free(ptr, 1));
const WebCss2dRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcss2drenderer_free(ptr, 1));
const WebCubeRenderTargetFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcuberendertarget_free(ptr, 1));
const WebCubeTextureFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcubetexture_free(ptr, 1));
const WebCylindricalFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webcylindrical_free(ptr, 1));
const WebDataTextureFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webdatatexture_free(ptr, 1));
const WebEffectComposerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webeffectcomposer_free(ptr, 1));
const WebEllipseCurveFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webellipsecurve_free(ptr, 1));
const WebEulerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webeuler_free(ptr, 1));
const WebExrLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webexrloader_free(ptr, 1));
const WebFbxLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webfbxloader_free(ptr, 1));
const WebFirstPersonControlsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webfirstpersoncontrols_free(ptr, 1));
const WebFrustumFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webfrustum_free(ptr, 1));
const WebFxaaPassFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webfxaapass_free(ptr, 1));
const WebGeometryFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webgeometry_free(ptr, 1));
const WebGltfExporterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webgltfexporter_free(ptr, 1));
const WebGridHelperFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webgridhelper_free(ptr, 1));
const WebHdrLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webhdrloader_free(ptr, 1));
const WebIkServoPlantFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webikservoplant_free(ptr, 1));
const WebKtx2LoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webktx2loader_free(ptr, 1));
const WebKtx2TextureFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webktx2texture_free(ptr, 1));
const WebLightFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_weblight_free(ptr, 1));
const WebLine3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webline3_free(ptr, 1));
const WebLineCurveFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_weblinecurve_free(ptr, 1));
const WebLineCurve3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_weblinecurve3_free(ptr, 1));
const WebMarchingCubesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmarchingcubes_free(ptr, 1));
const WebMaterialFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmaterial_free(ptr, 1));
const WebMathUtilsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmathutils_free(ptr, 1));
const WebMatrix3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmatrix3_free(ptr, 1));
const WebMatrix4Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmatrix4_free(ptr, 1));
const WebMeshFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webmesh_free(ptr, 1));
const WebObjLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webobjloader_free(ptr, 1));
const WebObject3DFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webobject3d_free(ptr, 1));
const WebObjectHandleFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webobjecthandle_free(ptr, 1));
const WebOctreeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_weboctree_free(ptr, 1));
const WebOrbitControlsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_weborbitcontrols_free(ptr, 1));
const WebPathFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webpath_free(ptr, 1));
const WebPlaneFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webplane_free(ptr, 1));
const WebPlyLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webplyloader_free(ptr, 1));
const WebPmremGeneratorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webpmremgenerator_free(ptr, 1));
const WebPointerLockControlsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webpointerlockcontrols_free(ptr, 1));
const WebPolarGridHelperFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webpolargridhelper_free(ptr, 1));
const WebQuaternionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webquaternion_free(ptr, 1));
const WebRayFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webray_free(ptr, 1));
const WebRaycasterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webraycaster_free(ptr, 1));
const WebRenderPassFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webrenderpass_free(ptr, 1));
const WebRenderTargetFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webrendertarget_free(ptr, 1));
const WebRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webrenderer_free(ptr, 1));
const WebSceneFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webscene_free(ptr, 1));
const WebShaderMaterialFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webshadermaterial_free(ptr, 1));
const WebShapeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webshape_free(ptr, 1));
const WebSimplexNoiseFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_websimplexnoise_free(ptr, 1));
const WebSphereFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_websphere_free(ptr, 1));
const WebSphericalFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webspherical_free(ptr, 1));
const WebStatsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webstats_free(ptr, 1));
const WebStlLoaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webstlloader_free(ptr, 1));
const WebSvgRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_websvgrenderer_free(ptr, 1));
const WebTextureFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webtexture_free(ptr, 1));
const WebTrackballControlsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webtrackballcontrols_free(ptr, 1));
const WebTriangleFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webtriangle_free(ptr, 1));
const WebVector2Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webvector2_free(ptr, 1));
const WebVector3Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webvector3_free(ptr, 1));
const WebVector4Finalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webvector4_free(ptr, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_export5(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI16FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayI8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(takeObject(mem.getUint32(i, true)));
    }
    return result;
}

function getArrayJsValueViewFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(getObject(mem.getUint32(i, true)));
    }
    return result;
}

function getArrayU16FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt16ArrayMemory0 = null;
function getInt16ArrayMemory0() {
    if (cachedInt16ArrayMemory0 === null || cachedInt16ArrayMemory0.byteLength === 0) {
        cachedInt16ArrayMemory0 = new Int16Array(wasm.memory.buffer);
    }
    return cachedInt16ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

let cachedInt8ArrayMemory0 = null;
function getInt8ArrayMemory0() {
    if (cachedInt8ArrayMemory0 === null || cachedInt8ArrayMemory0.byteLength === 0) {
        cachedInt8ArrayMemory0 = new Int8Array(wasm.memory.buffer);
    }
    return cachedInt8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_export5(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt16ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedInt8ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            module = module.module;
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            module_or_path = module_or_path.module_or_path;
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('threers_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
