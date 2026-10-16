//! Per-city building index: centroid, bbox and the filterable attributes of every building in
//! flat arrays, plus a centroid grid. Built once from the tiles on first use (about a second
//! for SF, a few for the Bay Area) so spatial and attribute queries don't touch tiles at all.

use std::collections::HashMap;

pub const CELL: f32 = 100.0;

pub struct Index {
    pub cx: Vec<f32>,
    pub cz: Vec<f32>,
    /// footprint bbox in the city frame (x0, z0, x1, z1), metres
    pub bbox: Vec<[f32; 4]>,
    pub year: Vec<i16>,
    pub period: Vec<u8>,
    pub use_: Vec<u8>,
    pub flags: Vec<u8>,
    pub floors: Vec<u8>,
    pub height: Vec<f32>,
    pub year_src: Vec<u8>,
    /// year demolished, 0 = standing
    pub demolished: Vec<i16>,
    /// largest half-diagonal of any footprint: how far a centroid can be from a point it covers
    pub max_reach: f32,
    grid: HashMap<(i32, i32), Vec<u32>>,
}

impl Index {
    pub fn with_capacity(n: usize) -> Index {
        Index {
            cx: Vec::with_capacity(n),
            cz: Vec::with_capacity(n),
            bbox: Vec::with_capacity(n),
            year: Vec::with_capacity(n),
            period: Vec::with_capacity(n),
            use_: Vec::with_capacity(n),
            flags: Vec::with_capacity(n),
            floors: Vec::with_capacity(n),
            height: Vec::with_capacity(n),
            year_src: Vec::with_capacity(n),
            demolished: Vec::with_capacity(n),
            max_reach: 0.0,
            grid: HashMap::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.cx.len()
    }

    fn cell(x: f32, z: f32) -> (i32, i32) {
        ((x / CELL).floor() as i32, (z / CELL).floor() as i32)
    }

    /// Call after the arrays are filled.
    pub fn build_grid(&mut self) {
        let mut reach = 0.0f32;
        for g in 0..self.len() {
            self.grid.entry(Index::cell(self.cx[g], self.cz[g])).or_default().push(g as u32);
            let [x0, z0, x1, z1] = self.bbox[g];
            let dx = (x0 - self.cx[g]).abs().max((x1 - self.cx[g]).abs());
            let dz = (z0 - self.cz[g]).abs().max((z1 - self.cz[g]).abs());
            reach = reach.max((dx * dx + dz * dz).sqrt());
        }
        self.max_reach = reach;
    }

    /// Buildings whose centroid is inside the box.
    pub fn in_box(&self, x0: f32, z0: f32, x1: f32, z1: f32) -> Vec<u32> {
        let (a, b) = (Index::cell(x0, z0), Index::cell(x1, z1));
        let mut out = Vec::new();
        // a huge box is cheaper as a scan than as a walk over empty cells
        if ((b.0 - a.0 + 1) as i64) * ((b.1 - a.1 + 1) as i64) > self.grid.len() as i64 {
            for g in 0..self.len() {
                if self.cx[g] >= x0 && self.cx[g] <= x1 && self.cz[g] >= z0 && self.cz[g] <= z1 {
                    out.push(g as u32);
                }
            }
            return out;
        }
        for i in a.0..=b.0 {
            for j in a.1..=b.1 {
                if let Some(v) = self.grid.get(&(i, j)) {
                    for &g in v {
                        let (x, z) = (self.cx[g as usize], self.cz[g as usize]);
                        if x >= x0 && x <= x1 && z >= z0 && z <= z1 {
                            out.push(g);
                        }
                    }
                }
            }
        }
        out.sort_unstable();
        out
    }

    /// Buildings whose centroid is within `r` metres, nearest first.
    pub fn near(&self, x: f32, z: f32, r: f32) -> Vec<(f32, u32)> {
        let mut out: Vec<(f32, u32)> = self
            .in_box(x - r, z - r, x + r, z + r)
            .into_iter()
            .map(|g| (((self.cx[g as usize] - x).powi(2) + (self.cz[g as usize] - z).powi(2)).sqrt(), g))
            .filter(|(d, _)| *d <= r)
            .collect();
        out.sort_by(|a, b| a.0.total_cmp(&b.0));
        out
    }

    /// Candidates for "which building is at (x, z)": footprint bbox within `slack` of the point.
    pub fn covering(&self, x: f32, z: f32, slack: f32) -> Vec<u32> {
        let r = self.max_reach.min(800.0) + slack;
        let mut v: Vec<u32> = self
            .in_box(x - r, z - r, x + r, z + r)
            .into_iter()
            .filter(|&g| {
                let [x0, z0, x1, z1] = self.bbox[g as usize];
                x >= x0 - slack && x <= x1 + slack && z >= z0 - slack && z <= z1 + slack
            })
            .collect();
        v.sort_by(|&a, &b| {
            let d = |g: u32| (self.cx[g as usize] - x).powi(2) + (self.cz[g as usize] - z).powi(2);
            d(a).total_cmp(&d(b))
        });
        v
    }
}
