//! Building tiles: one tile = the buildings of one square of the city, little-endian.
//!
//! SFT5 (written since 2026-10-14; see crates/pipeline/FORMAT.md) is SFT4 made small for the wire:
//! no per-building gid (`gid0 + i`), counts instead of cumulative offsets, heights and ground
//! in decimetres, no hole flags (a part's first ring is its outer ring, the rest are holes),
//! no roof triangles (clients triangulate), and the vertices delta-coded per ring as zigzag
//! varints. Compressed, a city is about 40% smaller than in SFT4.
//!
//! SFT6 is SFT5 plus, after the vertex stream, the parts that are not flat-topped prisms
//! standing on the ground: a sparse list of (part, bottom height, roof shape, roof height), then
//! the buildings that no longer stand: a sparse list of (building, year demolished).
//! A tile with neither is written as SFT5.
//!
//! `decode` reads SFT3, SFT4, SFT5 and SFT6 into the same arrays (the SFT4 layout).

use anyhow::{bail, ensure, Result};

pub const SFT5: &[u8; 4] = b"SFT5";
pub const SFT6: &[u8; 4] = b"SFT6";

/// Roof shapes (`Tile::roof_shape`): the part's walls stop at `height - roof_height`, and the
/// roof rises from the outer ring to a point over its centre.
pub const ROOF_FLAT: u8 = 0;
pub const ROOF_DOME: u8 = 1;
pub const ROOF_ONION: u8 = 2;
pub const ROOF_PYRAMID: u8 = 3;

#[derive(Default, Debug, Clone, PartialEq)]
pub struct Tile {
    pub gid0: u32,
    pub origin: [f32; 2],
    pub year: Vec<i16>,
    pub flag: Vec<u8>,
    pub period: Vec<u8>,
    pub floors: Vec<u8>,
    pub use_: Vec<u8>,
    pub year_src: Vec<u8>,
    pub height_src: Vec<u8>,
    /// parts of building b: `part_start[b]..part_start[b+1]`
    pub part_start: Vec<u32>,
    pub height: Vec<f32>,
    pub base: Vec<f32>,
    /// rings of part p; the first is the outer ring
    pub ring_start: Vec<u32>,
    /// vertices of ring r
    pub vert_start: Vec<u32>,
    /// x, z pairs in decimetres from `origin`
    pub xz: Vec<i16>,
    /// Per part, or empty when every part stands on the ground with a flat roof:
    /// height of the part's bottom above the ground (m), its roof shape (ROOF_*) and the
    /// height of the roof (m, included in `height`).
    pub min_height: Vec<f32>,
    pub roof_shape: Vec<u8>,
    pub roof_height: Vec<f32>,
    /// Per building, or empty when all stand: the year it was demolished (0 = standing).
    pub demolished: Vec<i16>,
}

impl Tile {
    pub fn n_buildings(&self) -> usize {
        self.year.len()
    }
}

fn pad4(w: &mut Vec<u8>) {
    while w.len() % 4 != 0 {
        w.push(0);
    }
}
fn varint(w: &mut Vec<u8>, mut v: u32) {
    while v >= 0x80 {
        w.push((v as u8 & 0x7f) | 0x80);
        v >>= 7;
    }
    w.push(v as u8);
}
fn zigzag(v: i32) -> u32 {
    ((v << 1) ^ (v >> 31)) as u32
}
fn unzigzag(v: u32) -> i32 {
    ((v >> 1) as i32) ^ -((v & 1) as i32)
}
fn dm_u16(m: f32) -> u16 {
    (m * 10.0).round().clamp(0.0, 65535.0) as u16
}
fn dm_i16(m: f32) -> i16 {
    (m * 10.0).round().clamp(-32768.0, 32767.0) as i16
}

/// SFT5 bytes for a tile, or SFT6 when a part floats or has a shaped roof.
pub fn encode(t: &Tile) -> Vec<u8> {
    let (nb, np, nr) = (t.n_buildings(), t.height.len(), t.vert_start.len() - 1);
    let nv = t.xz.len() / 2;
    let at = |v: &Vec<f32>, p: usize| v.get(p).copied().unwrap_or(0.0);
    let special: Vec<usize> = (0..np)
        .filter(|&p| dm_u16(at(&t.min_height, p)) > 0 || t.roof_shape.get(p).is_some_and(|&s| s != ROOF_FLAT))
        .collect();
    let gone: Vec<usize> = (0..nb).filter(|&b| t.demolished.get(b).is_some_and(|&y| y != 0)).collect();
    let v6 = !special.is_empty() || !gone.is_empty();
    let mut w = Vec::with_capacity(64 + nb * 12 + np * 8 + nr * 2 + nv * 3 + special.len() * 9 + gone.len() * 6);
    w.extend_from_slice(if v6 { SFT6 } else { SFT5 });
    for n in [nb as u32, np as u32, nr as u32, nv as u32, t.gid0] {
        w.extend_from_slice(&n.to_le_bytes());
    }
    w.extend_from_slice(&t.origin[0].to_le_bytes());
    w.extend_from_slice(&t.origin[1].to_le_bytes());
    for y in &t.year {
        w.extend_from_slice(&y.to_le_bytes());
    }
    pad4(&mut w);
    for a in [&t.flag, &t.period, &t.floors, &t.use_, &t.year_src, &t.height_src] {
        w.extend_from_slice(a);
        pad4(&mut w);
    }
    let counts = |w: &mut Vec<u8>, s: &[u32]| {
        for p in s.windows(2) {
            w.extend_from_slice(&((p[1] - p[0]) as u16).to_le_bytes());
        }
        pad4(w);
    };
    counts(&mut w, &t.part_start);
    for h in &t.height {
        w.extend_from_slice(&dm_u16(*h).to_le_bytes());
    }
    pad4(&mut w);
    for b in &t.base {
        w.extend_from_slice(&dm_i16(*b).to_le_bytes());
    }
    pad4(&mut w);
    counts(&mut w, &t.ring_start);
    counts(&mut w, &t.vert_start);
    let mut s = Vec::with_capacity(nv * 3);
    for r in 0..nr {
        let (mut px, mut pz) = (0i32, 0i32);
        for v in t.vert_start[r] as usize..t.vert_start[r + 1] as usize {
            let (x, z) = (t.xz[2 * v] as i32, t.xz[2 * v + 1] as i32);
            varint(&mut s, zigzag(x - px));
            varint(&mut s, zigzag(z - pz));
            (px, pz) = (x, z);
        }
    }
    w.extend_from_slice(&(s.len() as u32).to_le_bytes());
    w.extend_from_slice(&s);
    pad4(&mut w);
    if v6 {
        w.extend_from_slice(&(special.len() as u32).to_le_bytes());
        for &p in &special {
            w.extend_from_slice(&(p as u32).to_le_bytes());
        }
        for v in [&t.min_height, &t.roof_height] {
            for &p in &special {
                w.extend_from_slice(&dm_u16(at(v, p)).to_le_bytes());
            }
            pad4(&mut w);
        }
        for &p in &special {
            w.push(t.roof_shape.get(p).copied().unwrap_or(ROOF_FLAT));
        }
        pad4(&mut w);
        w.extend_from_slice(&(gone.len() as u32).to_le_bytes());
        for &b in &gone {
            w.extend_from_slice(&(b as u32).to_le_bytes());
        }
        for &b in &gone {
            w.extend_from_slice(&t.demolished[b].to_le_bytes());
        }
        pad4(&mut w);
    }
    w
}

struct Rd<'a> {
    b: &'a [u8],
    o: usize,
}
impl<'a> Rd<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        ensure!(self.o + n <= self.b.len(), "tile truncated at {}", self.o);
        let s = &self.b[self.o..self.o + n];
        self.o = (self.o + n + 3) & !3;
        Ok(s)
    }
    fn u8s(&mut self, n: usize) -> Result<Vec<u8>> {
        Ok(self.take(n)?.to_vec())
    }
    fn u16s(&mut self, n: usize) -> Result<Vec<u16>> {
        Ok(self.take(2 * n)?.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect())
    }
    fn i16s(&mut self, n: usize) -> Result<Vec<i16>> {
        Ok(self.take(2 * n)?.chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]])).collect())
    }
    fn u32s(&mut self, n: usize) -> Result<Vec<u32>> {
        Ok(self.take(4 * n)?.chunks_exact(4).map(|c| u32::from_le_bytes(c.try_into().unwrap())).collect())
    }
    fn f32s(&mut self, n: usize) -> Result<Vec<f32>> {
        Ok(self.take(4 * n)?.chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect())
    }
}

fn starts(counts: &[u16]) -> Vec<u32> {
    let mut v = Vec::with_capacity(counts.len() + 1);
    let mut a = 0u32;
    v.push(0);
    for &c in counts {
        a += c as u32;
        v.push(a);
    }
    v
}

/// Read an SFT3, SFT4, SFT5 or SFT6 tile.
pub fn decode(b: &[u8]) -> Result<Tile> {
    ensure!(b.len() >= 32, "tile too short");
    let u32_at = |o: usize| u32::from_le_bytes(b[o..o + 4].try_into().unwrap());
    let f32_at = |o: usize| f32::from_le_bytes(b[o..o + 4].try_into().unwrap());
    let magic = &b[..4];
    let (nb, np, nr, nv) = (u32_at(4) as usize, u32_at(8) as usize, u32_at(12) as usize, u32_at(16) as usize);
    let origin = [f32_at(24), f32_at(28)];
    let mut r = Rd { b, o: 32 };
    if magic == SFT5 || magic == SFT6 {
        let gid0 = u32_at(20);
        let year = r.i16s(nb)?;
        let (flag, period, floors, use_, year_src, height_src) = (r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?);
        let part_start = starts(&r.u16s(nb)?);
        let height = r.u16s(np)?.into_iter().map(|h| h as f32 / 10.0).collect();
        let base = r.i16s(np)?.into_iter().map(|h| h as f32 / 10.0).collect();
        let ring_start = starts(&r.u16s(np)?);
        let vert_start = starts(&r.u16s(nr)?);
        ensure!(part_start[nb] as usize == np && ring_start[np] as usize == nr && vert_start[nr] as usize == nv, "counts disagree with header");
        let len = u32::from_le_bytes(r.take(4)?.try_into().unwrap()) as usize;
        let s = r.take(len)?;
        let mut xz = Vec::with_capacity(2 * nv);
        let mut i = 0usize;
        let mut next = || -> Result<i32> {
            let (mut v, mut shift) = (0u32, 0);
            loop {
                ensure!(i < s.len(), "vertex stream truncated");
                let c = s[i];
                i += 1;
                v |= ((c & 0x7f) as u32) << shift;
                if c < 0x80 {
                    return Ok(unzigzag(v));
                }
                shift += 7;
                ensure!(shift < 35, "bad varint");
            }
        };
        for ring in 0..nr {
            let (mut x, mut z) = (0i32, 0i32);
            for _ in vert_start[ring]..vert_start[ring + 1] {
                x += next()?;
                z += next()?;
                xz.push(x as i16);
                xz.push(z as i16);
            }
        }
        let (mut min_height, mut roof_shape, mut roof_height, mut demolished) = (vec![], vec![], vec![], vec![]);
        if magic == SFT6 {
            let n = u32::from_le_bytes(r.take(4)?.try_into().unwrap()) as usize;
            let parts = r.u32s(n)?;
            let (mins, roofs, shapes) = (r.u16s(n)?, r.u16s(n)?, r.u8s(n)?);
            (min_height, roof_shape, roof_height) = (vec![0.0; np], vec![ROOF_FLAT; np], vec![0.0; np]);
            for i in 0..n {
                let p = parts[i] as usize;
                ensure!(p < np, "SFT6 part {p} out of range");
                (min_height[p], roof_height[p], roof_shape[p]) = (mins[i] as f32 / 10.0, roofs[i] as f32 / 10.0, shapes[i]);
            }
            if n == 0 {
                (min_height, roof_shape, roof_height) = (vec![], vec![], vec![]);
            }
            let n = u32::from_le_bytes(r.take(4)?.try_into().unwrap()) as usize;
            if n > 0 {
                let bs = r.u32s(n)?;
                let ys = r.i16s(n)?;
                demolished = vec![0; nb];
                for i in 0..n {
                    let b = bs[i] as usize;
                    ensure!(b < nb, "SFT6 building {b} out of range");
                    demolished[b] = ys[i];
                }
            }
        }
        return Ok(Tile {
            gid0, origin, year, flag, period, floors, use_, year_src, height_src, part_start, height, base, ring_start, vert_start, xz,
            min_height, roof_shape, roof_height, demolished,
        });
    }
    let v4 = magic == b"SFT4";
    if !(v4 || magic == b"SFT3") {
        bail!("not a building tile ({:?})", String::from_utf8_lossy(magic));
    }
    let nti = u32_at(20) as usize;
    let gids = r.u32s(nb)?;
    let year = r.i16s(nb)?;
    let (flag, period, floors, use_) = (r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?, r.u8s(nb)?);
    let part_start = r.u32s(nb + 1)?;
    let height = r.f32s(np)?;
    let base = r.f32s(np)?;
    let ring_start = r.u32s(np + 1)?;
    let vert_start = r.u32s(nr + 1)?;
    r.take(nr)?; // hole
    let xz = r.i16s(2 * nv)?;
    r.take(4 * (np + 1))?; // triStart
    r.take(2 * nti)?; // tri
    let (year_src, height_src) = if v4 { (r.u8s(nb)?, r.u8s(nb)?) } else { (vec![255; nb], vec![255; nb]) };
    Ok(Tile {
        gid0: gids.first().copied().unwrap_or(0), origin, year, flag, period, floors, use_, year_src, height_src, part_start, height, base,
        ring_start, vert_start, xz, ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let t = Tile {
            gid0: 70,
            origin: [250.0, -750.0],
            year: vec![1906, 0],
            flag: vec![1, 0],
            period: vec![1, 255],
            floors: vec![3, 1],
            use_: vec![0, 5],
            year_src: vec![0, 255],
            height_src: vec![1, 1],
            part_start: vec![0, 2, 3],
            height: vec![12.3, 40.0, 6.5],
            base: vec![55.2, 55.2, -1.5],
            ring_start: vec![0, 2, 3, 4],
            vert_start: vec![0, 4, 7, 11, 14],
            xz: vec![
                0, 0, 100, 0, 100, 100, 0, 100, 20, 20, 30, 20, 20, 30, -2000, -2000, -1900, -2000, -1900, -1900, -2000, -1900,
                32000, -32000, 32100, -32000, 32100, -31900,
            ],
            ..Default::default()
        };
        let b = encode(&t);
        assert_eq!(&b[..4], SFT5);
        let d = decode(&b).unwrap();
        assert_eq!(d, t);

        // a dome on a drum: SFT6
        let mut t6 = t.clone();
        t6.min_height = vec![0.0, 30.6, 0.0];
        t6.roof_shape = vec![ROOF_FLAT, ROOF_DOME, ROOF_FLAT];
        t6.roof_height = vec![0.0, 4.4, 0.0];
        let b6 = encode(&t6);
        assert_eq!(&b6[..4], SFT6);
        assert_eq!(decode(&b6).unwrap(), t6);
        assert_eq!(encode(&decode(&b6).unwrap()), b6);

        // a building that was demolished, in an otherwise plain tile
        let mut t7 = t.clone();
        t7.demolished = vec![0, 2004];
        let b7 = encode(&t7);
        assert_eq!(&b7[..4], SFT6);
        assert_eq!(decode(&b7).unwrap(), t7);
    }
}
