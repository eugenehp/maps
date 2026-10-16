//! Streaming on-disk building store: a sequence of
//! `[u64 LE byte length][bincode Vec<Building>]` chunks, so multi-million
//! building cities never need to be held in memory at once.

use crate::model::Building;
use anyhow::{Context, Result};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

pub const CHUNK: usize = 20_000;

pub struct Writer {
    w: BufWriter<File>,
    buf: Vec<Building>,
    tmp: PathBuf,
    path: PathBuf,
    count: usize,
}

impl Writer {
    pub fn create(path: &Path) -> Result<Self> {
        let tmp = path.with_extension("tmp");
        Ok(Writer { w: BufWriter::new(File::create(&tmp)?), buf: Vec::new(), tmp, path: path.into(), count: 0 })
    }
    pub fn push(&mut self, b: Building) -> Result<()> {
        self.buf.push(b);
        if self.buf.len() >= CHUNK {
            self.flush_chunk()?;
        }
        Ok(())
    }
    pub fn extend(&mut self, bs: impl IntoIterator<Item = Building>) -> Result<()> {
        bs.into_iter().try_for_each(|b| self.push(b))
    }
    fn flush_chunk(&mut self) -> Result<()> {
        if self.buf.is_empty() {
            return Ok(());
        }
        let bytes = bincode::serialize(&self.buf)?;
        self.w.write_all(&(bytes.len() as u64).to_le_bytes())?;
        self.w.write_all(&bytes)?;
        self.count += self.buf.len();
        self.buf.clear();
        Ok(())
    }
    /// Buildings pushed so far.
    pub fn count_pushed(&self) -> usize {
        self.count + self.buf.len()
    }
    /// Flush and atomically move into place.
    pub fn finish(mut self) -> Result<usize> {
        self.flush_chunk()?;
        self.w.flush()?;
        std::fs::rename(&self.tmp, &self.path)?;
        Ok(self.count)
    }
}

/// Call `f` once per stored chunk, in order.
pub fn for_each_chunk(path: &Path, mut f: impl FnMut(Vec<Building>) -> Result<()>) -> Result<()> {
    let file = File::open(path).with_context(|| format!("open {} (run the previous step)", path.display()))?;
    let mut r = BufReader::with_capacity(1 << 20, file);
    let mut len = [0u8; 8];
    let mut buf = Vec::new();
    loop {
        match r.read_exact(&mut len) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(()),
            Err(e) => return Err(e.into()),
        }
        buf.resize(u64::from_le_bytes(len) as usize, 0);
        r.read_exact(&mut buf)?;
        f(bincode::deserialize(&buf)?)?;
    }
}
