// WGSL for threers ShaderMaterial (see threers src/materials/shader_material.rs).
//
// Buildings: ONE material shared by every pack mesh.
//   uv.x  = global building id (gid), uv.y = part ground elevation (base)
//   position.y = 0 for ground vertices, part height for roof vertices
//   storage0[gid*4 + 0..3] = year (0 unknown), period (255 unknown), flags, floors + 256*use
//     + 2048*(year demolished - 1600; 0 = standing)
//   storage1: palette, sRGB (schemes.js): periods at [i*4], uses at [(16+u)*4], year sources at
//             [(22+s)*4], layer categories at [(48+c)*4], the storeys ramp at [112..115 * 4]
//   uniforms (u_data.data[i], see U below)
//
// Colours are authored and lit in sRGB (the LAYRS look), then converted to linear for
// framebuffer_encode, which expects linear light.

export const U = {
  YEAR: 0, MODE: 1, HOVER: 2, SELECTED: 3,
  RISE: 4, MASK: 5, FOG_NEAR: 6, FOG_FAR: 7,
  SKY: 8, RELIEF: 11,          // SKY r,g,b at 8..10
  UNKNOWN: 12, APPROX_MIX: 15, // UNKNOWN r,g,b at 12..14
  PALE: 16, TIME: 19,          // PALE r,g,b at 16..18
  SUN: 20,                     // SUN dir x,y,z at 20..22
  SHADOW: 23,                  // shadow strength (0 off)
  LAYER_AT: 24,                // time a layer was opened (rise animation)
  PREV_MODE: 25, MODE_AT: 26,  // the mode before the last switch, and when it happened (colour cross-fade)
  PREV_MASK: 27, MASK_AT: 28,  // the period mask before the last change, and when (rise / sink)
};
export const UNIFORM_FLOATS = 32;
export const PALETTE_USE_OFFSET = 16;
export const PALETTE_SOURCE_OFFSET = 22;
export const PALETTE_FLOORS_OFFSET = 112;

const COMMON = /* wgsl */`
fn to_lin(c: vec3<f32>) -> vec3<f32> {
  let x = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));
  let lo = x / 12.92;
  let hi = pow((x + vec3<f32>(0.055)) / 1.055, vec3<f32>(2.4));
  return select(hi, lo, x <= vec3<f32>(0.04045));
}
fn face_normal(p: vec3<f32>) -> vec3<f32> {
  var n = cross(dpdx(p), dpdy(p));
  let l = length(n);
  if (l < 1e-12) { return vec3<f32>(0.0, 1.0, 0.0); }
  n = n / l;
  if (dot(n, frame.camera_position.xyz - p) < 0.0) { n = -n; }
  return n;
}
`;

export const BUILDING_VERTEX = /* wgsl */`
fn pal(i: u32) -> vec3<f32> { return vec3<f32>(s1(i * 4u), s1(i * 4u + 1u), s1(i * 4u + 2u)); }

// storeys ramp: 4 stops (palette 112..115, schemes.js) on a log scale up to 40
fn floors_ramp(f: f32) -> vec3<f32> {
  let t = clamp(log(max(f, 1.0)) / log(40.0), 0.0, 1.0);
  let a = pal(112u);
  let b = pal(113u);
  let c = pal(114u);
  let d = pal(115u);
  if (t < 0.33) { return mix(a, b, t / 0.33); }
  if (t < 0.66) { return mix(b, c, (t - 0.33) / 0.33); }
  return mix(c, d, (t - 0.66) / 0.34);
}

// a building's colour in mode m (0 period, 1 floors, 2 use, 3 source, 4 layers)
fn mode_color(m: f32, period: u32, flags: u32, floors: f32, use_i: u32, ysrc: u32, li: f32) -> vec3<f32> {
  let d3 = u_data.data[3];
  let d4 = u_data.data[4];
  var c: vec3<f32>;
  if (m < 0.5) {
    if (period >= 16u) {
      c = d3.rgb;
    } else {
      c = pal(period);
      if ((flags & 16u) != 0u) { c = mix(c, d4.rgb, min(0.85, d3.w * 1.7)); }
      else if ((flags & 1u) == 1u) { c = mix(c, d4.rgb, d3.w); }
    }
  } else if (m < 1.5) {
    c = floors_ramp(floors);
  } else if (m < 2.5) {
    c = pal(16u + min(use_i, 5u));
  } else if (m < 3.5) {
    if (ysrc >= 255u) { c = d3.rgb; } else { c = pal(22u + ysrc % 26u); }
  } else if (li > -0.5) {
    c = pal(48u + u32(li + 0.5));
  } else {
    c = d4.rgb;
  }
  return c;
}
fn ease_io(x: f32) -> f32 { let t = clamp(x, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }

@vertex
fn vs_custom(in: VsIn) -> VsOut {
  var out = standard_vertex(in);
  let d0 = u_data.data[0];
  let d1 = u_data.data[1];
  let d2 = u_data.data[2];
  let d3 = u_data.data[3];
  let d4 = u_data.data[4];
  let gid = in.uv.x;
  let gi = u32(gid + 0.5) * 4u;
  let year = s0(gi);
  let period = u32(s0(gi + 1u) + 0.5);
  let fl = u32(s0(gi + 2u) + 0.5);
  let flags = fl & 255u;
  let ysrc = fl >> 8u;
  let fu0 = s0(gi + 3u);
  let dcode = floor(fu0 / 2048.0 + 0.0001);
  let fu = fu0 - 2048.0 * dcode;
  let use_i = u32(floor(fu / 256.0 + 0.001));
  let floors = fu - 256.0 * f32(use_i);
  let mode = d0.y;

  let d6 = u_data.data[6];
  let d7 = u_data.data[7];
  let now = d4.w;
  let seed = fract(sin(gid * 12.9898) * 43758.5453);
  // period filter (Period mode): a period switched on rises, one switched off sinks
  let pbit = min(period, 16u);
  let on_now = mode >= 0.5 || ((u32(d1.y + 0.5) >> pbit) & 1u) != 0u;
  let on_before = mode >= 0.5 || ((u32(d6.w + 0.5) >> pbit) & 1u) != 0u;
  let ft = ease_io((now - d7.x) / 0.45 - seed * 0.25);
  var vis = select(0.0, 1.0, on_now);
  if (on_now != on_before) { vis = select(1.0 - ft, ft, on_now); }
  let visible = vis > 0.003;
  // timeline: a building appears when the year reaches it, rising over d1.x years. While the
  // year moves (play, a drag) the buildings of one year start at staggered moments and settle
  // with a little overshoot; new ones are pale, like fresh stone, until they are up.
  var g = 1.0;
  var fresh = 0.0;
  let spread = clamp(d1.x, 0.0, 1.0) * 0.9;
  if (year > 0.5) {
    let r = clamp((d0.x - year - seed * spread + 1.0) / max(d1.x, 0.001), 0.0, 1.0);
    let q = r - 1.0;
    g = select(1.0 + 1.6 * q * q * q + 0.6 * q * q, r, d1.x < 0.05);
    fresh = (1.0 - r) * step(0.001, r);
  }
  // a demolished building darkens and sinks back into the ground over the year it came down
  var dust = 0.0;
  if (dcode > 0.5) {
    let k = clamp((1600.0 + dcode - seed * spread - d0.x) / max(d1.x, 0.001), 0.0, 1.0);
    g = g * ease_io(k);
    dust = (1.0 - k) * step(0.001, k);
  }
  g = g * vis;
  if (!visible || g <= 0.003) {
    out.clip_pos = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.clip_zw = out.clip_pos.zw;
    return out;
  }
  // Layers mode: buildings with a matching occupant rise out of the ground when a layer
  // opens (LAYRS), overshoot a little, settle; the rest stay as a pale maquette.
  let li = s2(u32(gid + 0.5));
  var rise = 1.0;
  if (mode > 3.5 && li > -0.5) {
    let k = clamp((d4.w - u_data.data[6].x) / 0.55 - seed * 0.6, 0.0, 1.0);
    let q = k - 1.0;
    rise = 1.0 + 2.70158 * q * q * q + 1.70158 * q * q;
  }
  let relief = d2.w;
  let base = in.uv.y * relief;
  var ly = in.position.y;
  if (ly < 0.001) { ly = base - 15.0 * relief; } else { ly = base + ly * g * max(rise, 0.02); }
  let wp = mesh.model * vec4<f32>(in.position.x, ly, in.position.z, 1.0);
  out.world_pos = wp.xyz;
  out.clip_pos = frame.view_proj * wp;
  out.clip_zw = out.clip_pos.zw;
  out.view_z = -(frame.view * wp).z;
  out.uv = vec2<f32>(gid, base);
  // edge-line inputs (the normal attribute is free: shading normals come from derivatives):
  // x = corner parity (alternates 0/1 round a ring), y = 0 at the wall foot, 1 at the roof,
  // z = corner code (see worker.js)
  out.world_normal = in.normal;

  // mode switch: cross-fade from the previous mode's colour, a little staggered
  var c = mode_color(mode, period, flags, floors, use_i, ysrc, li);
  let mt = ease_io((now - d6.z) / 0.45 - seed * 0.2);
  if (mt < 1.0 && abs(d6.y - mode) > 0.5) {
    c = mix(mode_color(d6.y, period, flags, floors, use_i, ysrc, li), c, mt);
  }
  c = mix(c, vec3<f32>(0.97, 0.96, 0.93), fresh * 0.55);
  c = mix(c, vec3<f32>(0.32, 0.30, 0.28), dust * 0.6);
  if (abs(gid - d0.z) < 0.5) { c = c * 0.62; }
  if (abs(gid - d0.w) < 0.5) { c = mix(c, vec3<f32>(0.05, 0.05, 0.08), 0.6); }
  out.vertex_color = vec4<f32>(c, 1.0);
  return out;
}
`;

export const BUILDING_FRAGMENT = COMMON + /* wgsl */`
@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d1 = u_data.data[1];
  let d2 = u_data.data[2];
  let d5 = u_data.data[5];
  let n = face_normal(in.world_pos);
  let dist = length(frame.camera_position.xyz - in.world_pos);
  // edge lines: pixel distance to a wall corner (parity crosses 0/1 there) and to the roof edge
  let par = in.world_normal.x;
  let up = in.world_normal.y;
  // fine (per-pixel) derivatives: coarse ones are constant over 2x2 blocks, which saws the lines
  let pw = max(fwidthFine(par), 1e-5);
  let uw = max(fwidthFine(up), 1e-5);
  let L = normalize(d5.xyz);
  // metres per pixel (distance x the angle a pixel subtends; the same in every direction). When
  // buildings are a few pixels across, the regular rows of lit walls, dark walls, roofs and shadows
  // are finer than the pixel grid and alias into moire bands that crawl as the city turns: fade that
  // detail toward an even tone as it gets that small.
  let vdir = normalize(in.world_pos - frame.camera_position.xyz);
  let mpp = dist * length(fwidthFine(vdir));
  let far = smoothstep(0.9, 4.0, mpp);
  // sun shadow (threers shadow map; 1 = lit): blocks the sun, and dims the sky light by d5.w
  var sh = 1.0;
  if (d5.w > 0.0) { sh = mix(shadow_factor(in.world_pos, n), 1.0, far * 0.85); }
  // hemispheric sky: cool from above, warm bounce from the ground; low SW sun
  let sky = mix(vec3<f32>(0.60, 0.58, 0.55), vec3<f32>(0.76, 0.79, 0.84), n.y * 0.5 + 0.5)
    * (1.0 - d5.w * (1.0 - sh));
  let sunc = vec3<f32>(0.52, 0.49, 0.44) * max(dot(n, L), 0.0) * sh;
  var light = sky + sunc;
  // the tone a roof would have: what a building's faces fade toward when it is a few pixels big
  let even = (vec3<f32>(0.70, 0.72, 0.75) + vec3<f32>(0.52, 0.49, 0.44) * max(L.y, 0.0) * 0.8) * 0.97;
  light = mix(light, even, far * 0.85);
  let hm = in.world_pos.y - in.uv.y;
  if (n.y <= 0.9) {
    // contact darkening at the foot of walls, then a gentle gradient up the lower floors
    light = light * mix(mix(0.62, 1.0, smoothstep(0.0, 5.0, hm)) * mix(0.86, 1.0, smoothstep(0.0, 30.0, hm)), 1.0, far);
    // which ends of this wall are real corners: code = (1-t)*cA + 2t*cB (see worker.js)
    let code = in.world_normal.z;
    var cornerPx = 1e9;
    if (par < 0.5 && code > 0.5) { cornerPx = par / pw; }
    if (par >= 0.5 && code > 1.0) { cornerPx = (1.0 - par) / pw; }
    // a corner line only where the wall between corners is wide on screen (1/pw px):
    // narrow facets would otherwise read as stripes
    cornerPx = cornerPx + 1e9 * (1.0 - smoothstep(6.0, 14.0, 1.0 / pw));
    // the roof line likewise only on walls tall on screen (1/uw px): on a building a few pixels
    // high a 1.5 px dark rim is most of the wall, and it crawls as the camera moves
    let roofPx = (1.0 - up) / uw + 1e9 * (1.0 - smoothstep(5.0, 12.0, 1.0 / uw));
    // (gated by on-screen size, not distance, so it looks the same at any resolution)
    let edgePx = min(cornerPx, roofPx);
    // a band just inside the edge (darkest ~1 px in), not at the edge itself: the edge pixel is
    // where the wall's and the roof's/next wall's coverage meet, a staircase that turned a line
    // drawn right on it into dashes
    let band = smoothstep(0.15, 0.8, edgePx) * (1.0 - smoothstep(1.3, 2.2, edgePx));
    light = light * (1.0 - 0.3 * band * (1.0 - far));
  } else {
    light = light * 1.04;
  }
  // a touch less saturated than the palette: LAYRS's softer print look
  var c = in.vertex_color.rgb;
  c = mix(vec3<f32>(dot(c, vec3<f32>(0.299, 0.587, 0.114))), c, 0.86) * 0.96 + 0.04;
  c = c * light;
  // aerial perspective: distance haze toward the sky colour, never all the way
  c = mix(c, d2.rgb, 0.85 * smoothstep(d1.z, d1.w, dist));
  return vec4<f32>(framebuffer_encode(to_lin(c)), 1.0);
}
`;

// Ground (land / water / parks / terrain): colour d0.rgb, hillshade amount d0.w, coastline
// threshold on uv.x if d1.x, shadow strength d1.y, fog d1.zw, fog colour d2.rgb, lift d3.x
// (metres, see GROUND_VERTEX), bathymetry-as-water d3.y with water colour d4.rgb.
export const GROUND_VERTEX = /* wgsl */`
@vertex
fn vs_custom(in: VsIn) -> VsOut {
  var out = standard_vertex(in);
  // Polygons drawn over the terrain are lifted by a distance-scaled amount (set per frame):
  // a fixed offset small enough to be invisible close up is lost in depth precision far away.
  out.world_pos.y = out.world_pos.y + u_data.data[3].x;
  out.clip_pos = frame.view_proj * vec4<f32>(out.world_pos, 1.0);
  out.clip_zw = out.clip_pos.zw;
  out.view_z = -(frame.view * vec4<f32>(out.world_pos, 1.0)).z;
  out.world_normal = in.normal;
  return out;
}
`;

export const GROUND_FRAGMENT = COMMON + /* wgsl */`
@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d0 = u_data.data[0];
  let d1 = u_data.data[1];
  let d2 = u_data.data[2];
  if (d1.x > 0.5 && in.uv.x < 0.5) { discard; }
  var c = d0.rgb;
  var n = vec3<f32>(0.0, 1.0, 0.0);
  if (d0.w > 0.0) {
    // smooth per-vertex terrain normals (ground.js), not the faceted derivative one
    n = normalize(in.world_normal);
    let s = dot(n, normalize(vec3<f32>(-0.55, 0.75, 0.62)));
    c = c * (1.0 - d0.w + d0.w * clamp(0.55 + 0.6 * s, 0.0, 1.15));
  }
  // DEM bathymetry (below datum 0) reads as water where no polygon covers it
  let d3 = u_data.data[3];
  if (d3.y > 0.5) {
    c = mix(u_data.data[4].rgb, c, smoothstep(-0.8, 0.6, in.world_pos.y));
  }
  if (d1.y > 0.0) {
    c = c * mix(1.0, shadow_factor(in.world_pos, n), d1.y);
  }
  let dist = length(frame.camera_position.xyz - in.world_pos);
  c = mix(c, d2.rgb, 0.85 * smoothstep(d1.z, d1.w, dist));
  return vec4<f32>(framebuffer_encode(to_lin(c)), 1.0);
}
`;
