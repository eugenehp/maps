//! Local metre frame and small polygon helpers.
//!
//! Frame: equirectangular around the city origin (ellipsoidal
//! metres-per-degree at lat0). x = metres east, z = metres SOUTH, so with
//! three.js Y-up the map lies in the XZ plane with north pointing to -Z.
//! Scale error is ~(cos lat / cos lat0 - 1): well under a metre across SF,
//! about +-1.5% in x at the far edges of the Bay Area.

pub struct Proj {
    lon0: f64,
    lat0: f64,
    mx: f64, // metres per degree longitude
    mz: f64, // metres per degree latitude
}

impl Proj {
    pub fn new(origin: [f64; 2]) -> Self {
        let (lon0, lat0) = (origin[0], origin[1]);
        let p = lat0.to_radians();
        // WGS84 metres per degree (standard series expansion).
        let mz = 111_132.954 - 559.822 * (2.0 * p).cos() + 1.175 * (4.0 * p).cos();
        let mx = 111_412.84 * p.cos() - 93.5 * (3.0 * p).cos();
        Proj { lon0, lat0, mx, mz }
    }
    /// lon/lat -> [x east, z south] metres
    pub fn fwd(&self, ll: [f64; 2]) -> [f64; 2] {
        [(ll[0] - self.lon0) * self.mx, -(ll[1] - self.lat0) * self.mz]
    }
    pub fn inv(&self, xz: [f64; 2]) -> [f64; 2] {
        [self.lon0 + xz[0] / self.mx, self.lat0 - xz[1] / self.mz]
    }
}

/// Twice the signed shoelace area in (x, z), exact on integer coordinates.
pub fn area2_i(ring: &[[i16; 2]]) -> i64 {
    let n = ring.len();
    (0..n)
        .map(|i| {
            let (a, b) = (ring[i], ring[(i + 1) % n]);
            a[0] as i64 * b[1] as i64 - b[0] as i64 * a[1] as i64
        })
        .sum()
}

/// Even-odd point-in-ring test.
pub fn in_ring(p: [f64; 2], ring: &[[f64; 2]]) -> bool {
    let mut inside = false;
    let n = ring.len();
    let mut j = n - 1;
    for i in 0..n {
        let (a, b) = (ring[i], ring[j]);
        if (a[1] > p[1]) != (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0] {
            inside = !inside;
        }
        j = i;
    }
    inside
}

/// Point inside a part (outer ring minus holes).
pub fn in_part(p: [f64; 2], rings: &[Vec<[f64; 2]>]) -> bool {
    match rings.split_first() {
        Some((outer, holes)) => in_ring(p, outer) && !holes.iter().any(|h| in_ring(p, h)),
        None => false,
    }
}

/// Area-weighted centroid of the outer rings (holes ignored; good enough
/// for tiling and neighbour search).
pub fn centroid(parts: &[Vec<Vec<[f64; 2]>>]) -> [f64; 2] {
    let (mut cx, mut cz, mut a) = (0.0, 0.0, 0.0);
    for ring in parts.iter().filter_map(|p| p.first()) {
        let n = ring.len();
        for i in 0..n {
            let (p, q) = (ring[i], ring[(i + 1) % n]);
            let c = p[0] * q[1] - q[0] * p[1];
            cx += (p[0] + q[0]) * c;
            cz += (p[1] + q[1]) * c;
            a += c;
        }
    }
    if a.abs() < 1e-12 {
        // Degenerate: fall back to the vertex mean.
        let pts: Vec<_> = parts.iter().flatten().flatten().collect();
        let n = pts.len().max(1) as f64;
        return [pts.iter().map(|p| p[0]).sum::<f64>() / n, pts.iter().map(|p| p[1]).sum::<f64>() / n];
    }
    [cx / (3.0 * a), cz / (3.0 * a)]
}

/// Fast point-in-polygon for big clip polygons (county boundaries): edges
/// are bucketed into horizontal bands and a +x ray is cast against the
/// edges of one band. Even-odd over all rings, so a set of disjoint
/// polygons (with holes) works as a single region.
pub struct PolyIndex {
    y0: f64,
    dy: f64,
    bands: Vec<Vec<[f64; 4]>>, // x1, y1, x2, y2
}

impl PolyIndex {
    pub fn new<'a>(rings: impl IntoIterator<Item = &'a Vec<[f64; 2]>> + Clone) -> Self {
        let (mut y0, mut y1) = (f64::MAX, f64::MIN);
        for p in rings.clone().into_iter().flatten() {
            y0 = y0.min(p[1]);
            y1 = y1.max(p[1]);
        }
        let n = 4096;
        let dy = ((y1 - y0) / n as f64).max(1e-12);
        let mut bands = vec![Vec::new(); n];
        for r in rings {
            for i in 0..r.len() {
                let (a, b) = (r[i], r[(i + 1) % r.len()]);
                if a[1] == b[1] {
                    continue;
                }
                let lo = (((a[1].min(b[1]) - y0) / dy) as usize).min(n - 1);
                let hi = (((a[1].max(b[1]) - y0) / dy) as usize).min(n - 1);
                for band in &mut bands[lo..=hi] {
                    band.push([a[0], a[1], b[0], b[1]]);
                }
            }
        }
        PolyIndex { y0, dy, bands }
    }

    pub fn contains(&self, p: [f64; 2]) -> bool {
        let k = (p[1] - self.y0) / self.dy;
        if k < 0.0 || k >= self.bands.len() as f64 {
            return false;
        }
        let mut inside = false;
        for e in &self.bands[k as usize] {
            if (e[1] > p[1]) != (e[3] > p[1]) && p[0] < (e[2] - e[0]) * (p[1] - e[1]) / (e[3] - e[1]) + e[0] {
                inside = !inside;
            }
        }
        inside
    }
}
