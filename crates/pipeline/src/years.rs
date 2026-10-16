//! Resolve each building's year, height and floors from its per-source
//! candidates, clean years per source, estimate missing ones.
//!
//! Priority: the city's `year_priority` / `height_priority` /
//! `floors_priority` lists; the first listed source with a valid value
//! wins. Candidates from unlisted sources never win and only count as
//! cross-checks. Disagreements (years > CONFLICT_YEARS apart, heights >
//! max(3 m, 25%) apart) are counted per source pair.
//!
//! Spikes, per source: a year whose building count is >= SPIKE_RATIO times
//! the median of the surrounding +-5 years (and >= SPIKE_MIN) stands out.
//! Strong spikes (YearPolicy::reestimate_ratio) are placeholders: skipped,
//! so a lower-priority source or a neighbour estimate fills in. Weaker
//! spikes on round years (multiples of 5), or any spike >= STRONG_SPIKE,
//! are rounding/defaults: kept, flagged approximate. Mild spikes on other
//! years (1942 war housing, 2019 fire rebuilds) are left alone.
//!
//! Missing years, in order: median of up to K nearest dated buildings of
//! the same fill group within its radii (approximate); the earliest
//! placeholder value (approximate); a last-resort census-area median
//! (NSI med_yr_blt; approximate + F_TRACT_YEAR); else unknown.
//!
//! Height: first valid measured candidate (MIN..MAX_MEASURED_M), else
//! floors * 3.2 m, else the building's default.

use crate::city::Ctx;
use crate::geom::{centroid, Proj};
use crate::model::*;
use crate::store::{for_each_chunk, Writer};
use anyhow::Result;
use rayon::prelude::*;
use rstar::{primitives::GeomWithData, RTree};
use std::collections::{BTreeMap, HashMap};

const SPIKE_RATIO: f64 = 2.5;
const SPIKE_MIN: usize = 500;
/// Spikes this strong are flagged even on non-round years (NYC 1899/1901 =
/// "before 1900").
const STRONG_SPIKE: f64 = 10.0;
const K: usize = 8;
const STOREY_M: f32 = 3.2;
/// Measured heights below this are noise (canopies, ground returns)...
const MIN_MEASURED_M: f32 = 2.0;
/// ...and above this they are errors (tallest US building ~541 m).
const MAX_MEASURED_M: f32 = 600.0;
const MAX_STOREYS: f32 = 165.0;
const CONFLICT_YEARS: i16 = 5;

struct Meta {
    ds: u8,
    c: [f64; 2],
    /// year demolished, 0 = standing
    gone: i16,
    /// (priority rank or usize::MAX for cross-check only, candidate)
    cands: Vec<(usize, YearCand)>,
}

#[derive(Clone, Copy, Default)]
struct Pick {
    year: i16,
    src: u8,
    approx: bool,
    tract: bool,
    shared: bool,
}

fn rank(prio: &[u8], src: u8) -> usize {
    prio.iter().position(|&s| s == src).unwrap_or(usize::MAX)
}

pub fn run(ctx: &Ctx) -> Result<()> {
    let city = ctx.city;
    let now = current_year();
    let proj = Proj::new(city.origin);
    let periods = city.periods;

    // Pass 1: centroids and plausible candidate years.
    let mut meta: Vec<Meta> = Vec::new();
    for_each_chunk(&ctx.joined(), |c| {
        meta.par_extend(c.into_par_iter().map(|b| {
            let mut cands: Vec<(usize, YearCand)> = b
                .year_c
                .into_iter()
                .filter_map(|mut yc| {
                    let ok = SOURCES[yc.src as usize].year.min_year..=now;
                    yc.years.retain(|y| ok.contains(y));
                    (!yc.years.is_empty()).then(|| (rank(city.year_priority, yc.src), yc))
                })
                .collect();
            cands.sort_by_key(|c| c.0);
            Meta { ds: b.dataset, c: proj.fwd(centroid(&b.parts)), gone: b.demolished, cands }
        }));
        Ok(())
    })?;
    let n = meta.len();

    // Spikes per source over each building's earliest year.
    let mut hists: BTreeMap<u8, BTreeMap<i16, usize>> = BTreeMap::new();
    for m in &meta {
        for (_, yc) in &m.cands {
            let pol = SOURCES[yc.src as usize].year;
            if !pol.curated && !pol.last_resort {
                *hists.entry(yc.src).or_default().entry(yc.years[0]).or_default() += 1;
            }
        }
    }
    let mut placeholder: HashMap<u8, Vec<i16>> = HashMap::new();
    let mut rounding: HashMap<u8, Vec<i16>> = HashMap::new();
    for (&src, hist) in &hists {
        let s = &SOURCES[src as usize];
        println!("-- {}: {} buildings with a year", s.id, hist.values().sum::<usize>());
        print_decades(hist, "raw years (earliest per building)");
        for (y, c, r) in find_spikes(hist) {
            let kind = if r >= s.year.reestimate_ratio {
                placeholder.entry(src).or_default().push(y);
                "placeholder, skipped"
            } else if y % 5 == 0 || r >= STRONG_SPIKE {
                rounding.entry(src).or_default().push(y);
                "rounding/default, flagged approximate"
            } else {
                "not a round year (real boom?), kept"
            };
            println!("   spike {y}: {c} buildings, {r:.1}x its neighbourhood -> {kind}");
        }
    }
    let is_ph = |src: u8, y: i16| placeholder.get(&src).is_some_and(|v| v.contains(&y));
    let is_round = |src: u8, y: i16| rounding.get(&src).is_some_and(|v| v.contains(&y));

    // Resolve by priority; count cross-source disagreements.
    let mut conflicts: BTreeMap<(u8, u8), [usize; 2]> = BTreeMap::new(); // (winner, other) -> [agree, conflict]
    let mut picks: Vec<Option<Pick>> = vec![None; n];
    for (i, m) in meta.iter().enumerate() {
        let first_ok = |yc: &YearCand| yc.years.iter().copied().find(|&y| !is_ph(yc.src, y));
        let win = m.cands.iter().filter(|(r, yc)| *r != usize::MAX && !SOURCES[yc.src as usize].year.last_resort).find_map(|(_, yc)| {
            first_ok(yc).map(|y| Pick { year: y, src: yc.src, approx: yc.circa || is_round(yc.src, y), tract: false, shared: yc.shared })
        });
        if let Some(w) = win {
            for (_, yc) in m.cands.iter().filter(|(_, yc)| yc.src != w.src && !SOURCES[yc.src as usize].year.last_resort) {
                if let Some(y) = first_ok(yc) {
                    conflicts.entry((w.src, yc.src)).or_default()[((y - w.year).abs() > CONFLICT_YEARS) as usize] += 1;
                }
            }
        }
        picks[i] = win;
    }

    // Neighbour estimates within each fill group.
    let mut groups: BTreeMap<u8, Vec<usize>> = BTreeMap::new();
    for (i, m) in meta.iter().enumerate() {
        groups.entry(m.ds).or_default().push(i);
    }
    let (mut estimated, mut kept_ph, mut tract) = (0, 0, 0);
    for (ds, idx) in &groups {
        let radii = SOURCES[*ds as usize].year.radii;
        if radii.is_empty() {
            continue;
        }
        let tree = RTree::bulk_load(
            idx.iter().filter_map(|&i| picks[i].map(|p| GeomWithData::new(meta[i].c, p.year))).collect::<Vec<_>>(),
        );
        let est: Vec<(usize, i16)> = idx
            .par_iter()
            .filter(|&&i| picks[i].is_none())
            .filter_map(|&i| {
                radii.iter().find_map(|r| {
                    let mut ys: Vec<i16> = tree
                        .nearest_neighbor_iter_with_distance_2(meta[i].c)
                        .take_while(|(_, d2)| *d2 <= r * r)
                        .take(K)
                        .map(|(g, _)| g.data)
                        .collect();
                    ys.sort_unstable();
                    ys.get(ys.len() / 2).map(|&y| (i, y))
                })
            })
            .collect();
        for (i, y) in est {
            picks[i] = Some(Pick { year: y, src: S_NEIGHBOURS, approx: true, ..Default::default() });
            estimated += 1;
        }
    }
    // A demolished building with no year of its own: the median year of the dated buildings
    // around it that were already up some years before it came down, standing or demolished.
    // Without this it would stand from the start of the timeline, grey.
    let gone_est = {
        let undated: Vec<usize> = (0..n).filter(|&i| meta[i].gone != 0 && picks[i].is_none()).collect();
        if undated.is_empty() {
            0
        } else {
            let tree = RTree::bulk_load(
                (0..n).filter_map(|i| picks[i].map(|p| GeomWithData::new(meta[i].c, p.year))).collect::<Vec<_>>(),
            );
            let est: Vec<(usize, i16)> = undated
                .par_iter()
                .filter_map(|&i| {
                    let before = meta[i].gone - 5;
                    [100.0f64, 300.0, 1000.0].iter().find_map(|r| {
                        let mut ys: Vec<i16> = tree
                            .nearest_neighbor_iter_with_distance_2(meta[i].c)
                            .take_while(|(_, d2)| *d2 <= r * r)
                            .map(|(g, _)| g.data)
                            .filter(|&y| y <= before)
                            .take(K)
                            .collect();
                        ys.sort_unstable();
                        ys.get(ys.len() / 2).map(|&y| (i, y))
                    })
                })
                .collect();
            let k = est.len();
            for (i, y) in est {
                picks[i] = Some(Pick { year: y, src: S_NEIGHBOURS, approx: true, ..Default::default() });
            }
            k
        }
    };
    if gone_est > 0 {
        println!("demolished buildings with no year: {gone_est} estimated from the buildings around them");
    }
    for (i, m) in meta.iter().enumerate() {
        if picks[i].is_some() {
            continue;
        }
        // An isolated placeholder is better than nothing...
        if let Some((_, yc)) = m.cands.iter().find(|(r, yc)| *r != usize::MAX && !SOURCES[yc.src as usize].year.last_resort) {
            picks[i] = Some(Pick { year: yc.years[0], src: yc.src, approx: true, shared: yc.shared, ..Default::default() });
            kept_ph += 1;
        // ...and an area median is the last resort.
        } else if let Some((_, yc)) = m.cands.iter().find(|(r, yc)| *r != usize::MAX && SOURCES[yc.src as usize].year.last_resort) {
            picks[i] = Some(Pick { year: yc.years[0], src: yc.src, approx: true, tract: true, ..Default::default() });
            tract += 1;
        }
    }
    println!(
        "missing years: estimated from neighbours {estimated}, kept placeholder {kept_ph}, census-area median {tract}, still unknown {}",
        picks.iter().filter(|p| p.is_none()).count()
    );
    drop(meta);

    // Pass 2: apply, resolve height / floors, derive period.
    let mut year_mix: BTreeMap<u8, [usize; 2]> = BTreeMap::new(); // src -> [exact, approx]
    let mut height_mix: BTreeMap<(u8, u8), usize> = BTreeMap::new(); // (H_*, src)
    let mut floors_mix: BTreeMap<u8, usize> = BTreeMap::new();
    let mut h_conf: BTreeMap<(u8, u8), [usize; 2]> = BTreeMap::new();
    let mut per_period = vec![[0usize; 2]; periods.len() + 1];
    let mut by_area: BTreeMap<String, [usize; 4]> = BTreeMap::new(); // total, exact, approx, tract
    let mut w = Writer::create(&ctx.buildings())?;
    let mut k = 0;
    for_each_chunk(&ctx.joined(), |mut c| {
        for b in c.iter_mut() {
            let p = picks[k];
            k += 1;
            let p = p.unwrap_or(Pick { src: S_NONE, ..Default::default() });
            (b.year, b.year_src, b.approx, b.tract_year, b.parcel_shared) = (p.year, p.src, p.approx, p.tract, p.shared);
            if p.year > 0 {
                year_mix.entry(p.src).or_default()[p.approx as usize] += 1;
            }

            // Height.
            let ok_h = |h: f32| (MIN_MEASURED_M..=MAX_MEASURED_M).contains(&h);
            let mut hs: Vec<(usize, u8, f32)> =
                b.height_c.iter().map(|&(s, h)| (rank(city.height_priority, s), s, h)).filter(|x| ok_h(x.2)).collect();
            hs.sort_by_key(|x| x.0);
            let mut fl: Vec<(usize, u8, f32)> = b
                .floors_c
                .iter()
                .map(|&(s, f)| (rank(city.floors_priority, s), s, f))
                .filter(|x| x.0 != usize::MAX && (1.0..=MAX_STOREYS).contains(&x.2))
                .collect();
            fl.sort_by_key(|x| x.0);
            let floors = fl.first().map(|x| (x.1, x.2));
            (b.height, b.height_src, b.height_from) = match (hs.iter().find(|x| x.0 != usize::MAX), floors) {
                (Some(&(_, s, h)), _) => {
                    for &(_, s2, h2) in hs.iter().filter(|x| x.1 != s) {
                        h_conf.entry((s, s2)).or_default()[((h - h2).abs() > (0.25 * h).max(3.0)) as usize] += 1;
                    }
                    (h, H_MEASURED, s)
                }
                (None, Some((s, f))) => (f * STOREY_M, H_FLOORS, s),
                _ => (b.height_default, H_DEFAULT, S_DEFAULT),
            };
            *height_mix.entry((b.height_src, b.height_from)).or_default() += 1;
            b.floors = floors.map_or((b.height / STOREY_M).round(), |f| f.1.round()).clamp(1.0, 255.0) as u8;
            *floors_mix.entry(floors.map_or(S_NONE, |f| f.0)).or_default() += 1;

            b.period = period_of(periods, b.year);
            let pi = if b.period == PERIOD_UNKNOWN { periods.len() } else { b.period as usize };
            per_period[pi][b.approx as usize] += 1;
            let a = by_area.entry(b.area.clone()).or_default();
            a[0] += 1;
            a[1] += (b.year > 0 && !b.approx) as usize;
            a[2] += (b.year > 0 && b.approx && !b.tract_year) as usize;
            a[3] += b.tract_year as usize;
        }
        w.extend(c)
    })?;
    w.finish()?;

    let pct = |x: usize| 100.0 * x as f64 / n.max(1) as f64;
    let name = |s: u8| if s == S_NONE { "(none)" } else { SOURCES[s as usize].id };
    println!("year source mix (exact / approximate, % of all buildings):");
    for (s, [e, a]) in &year_mix {
        println!("  {:<24} {:>5.1}% {:>5.1}%", name(*s), pct(*e), pct(*a));
    }
    println!("  {:<24} {:>5.1}%", "unknown", pct(n - year_mix.values().map(|v| v[0] + v[1]).sum::<usize>()));
    println!("year cross-checks (winner vs other: agree / >{CONFLICT_YEARS} y apart):");
    for ((a, b), [ok, bad]) in &conflicts {
        println!("  {:<24} vs {:<24} {:>8} {:>8} ({:.1}% conflict)", name(*a), name(*b), ok, bad, 100.0 * *bad as f64 / (*ok + *bad) as f64);
    }
    println!("height source mix:");
    for ((m, s), c) in &height_mix {
        let how = ["measured", "floors", "default"][*m as usize];
        println!("  {how:<9} {:<24} {:>5.1}%", name(*s), pct(*c));
    }
    if !h_conf.is_empty() {
        println!("height cross-checks (winner vs other: agree / differ > max(3 m, 25%)):");
        for ((a, b), [ok, bad]) in &h_conf {
            println!("  {:<24} vs {:<24} {:>8} {:>8} ({:.1}% conflict)", name(*a), name(*b), ok, bad, 100.0 * *bad as f64 / (*ok + *bad) as f64);
        }
    }
    println!("floors source mix: {}", floors_mix.iter().map(|(s, c)| format!("{} {:.1}%", name(*s), pct(*c))).collect::<Vec<_>>().join(", "));
    println!("by period (exact / approximate):");
    for (i, per) in periods.iter().enumerate() {
        println!("  {i} {:<24} {:>4}-{:<4} {:>8} {:>8}", per.name, per.from, per.to.min(now), per_period[i][0], per_period[i][1]);
    }
    println!("  - unknown {:>46}", per_period[periods.len()][0]);
    if by_area.len() > 1 {
        println!("year coverage by area (exact / approximate / area-median / none):");
        for (a, c) in &by_area {
            let p = |x: usize| 100.0 * x as f64 / c[0] as f64;
            println!("  {a:<16} {:>8}  {:>5.1}% {:>5.1}% {:>5.1}% {:>5.1}%", c[0], p(c[1]), p(c[2]), p(c[3]), p(c[0] - c[1] - c[2] - c[3]));
        }
    }
    println!("wrote {n} buildings to {}", ctx.buildings().display());
    Ok(())
}

/// (year, count, ratio) for years that stand out from their neighbourhood.
fn find_spikes(hist: &BTreeMap<i16, usize>) -> Vec<(i16, usize, f64)> {
    let get = |y: i16| hist.get(&y).copied().unwrap_or(0);
    hist.iter()
        .filter_map(|(&y, &c)| {
            let mut around: Vec<usize> = (y - 5..=y + 5).filter(|&x| x != y).map(get).collect();
            around.sort_unstable();
            let med = (around[4] + around[5]) as f64 / 2.0;
            let r = c as f64 / med.max(1.0);
            (c >= SPIKE_MIN && r >= SPIKE_RATIO).then_some((y, c, r))
        })
        .collect()
}

fn print_decades(hist: &BTreeMap<i16, usize>, title: &str) {
    let mut dec: BTreeMap<i16, usize> = BTreeMap::new();
    for (y, c) in hist {
        *dec.entry(y / 10 * 10).or_default() += c;
    }
    let max = dec.values().copied().max().unwrap_or(1);
    println!("   {title}:");
    for (d, c) in dec {
        println!("     {d}s {c:>8} {}", "#".repeat((c * 50).div_ceil(max)));
    }
    let mut v: Vec<_> = hist.iter().collect();
    v.sort_by(|a, b| b.1.cmp(a.1));
    let top: Vec<String> = v.iter().take(8).map(|(y, c)| format!("{y}:{c}")).collect();
    println!("     most common: {}", top.join(" "));
}
