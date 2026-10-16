//! Arrow column helpers for locally written parquet files.

use anyhow::{bail, Context, Result};
use arrow_array::{cast::AsArray, Array};
use arrow_schema::DataType;

pub fn strs(a: &dyn Array) -> Result<Vec<Option<&str>>> {
    Ok(match a.data_type() {
        DataType::Utf8 => a.as_string::<i32>().iter().collect(),
        DataType::LargeUtf8 => a.as_string::<i64>().iter().collect(),
        DataType::Utf8View => a.as_string_view().iter().collect(),
        t => bail!("expected string column, got {t}"),
    })
}

pub fn bins(a: &dyn Array) -> Result<Vec<Option<&[u8]>>> {
    Ok(match a.data_type() {
        DataType::Binary => a.as_binary::<i32>().iter().collect(),
        DataType::LargeBinary => a.as_binary::<i64>().iter().collect(),
        DataType::BinaryView => a.as_binary_view().iter().collect(),
        t => bail!("expected binary column, got {t}"),
    })
}

pub fn f64s(a: &dyn Array) -> Result<Vec<Option<f64>>> {
    use arrow_array::types::{Float32Type, Float64Type};
    if let Some(p) = a.as_primitive_opt::<Float32Type>() {
        return Ok(p.iter().map(|v| v.map(f64::from)).collect());
    }
    if let Some(p) = a.as_primitive_opt::<Float64Type>() {
        return Ok(p.iter().collect());
    }
    Ok(i64s(a).context("expected a number column")?.into_iter().map(|v| v.map(|x| x as f64)).collect())
}

pub fn i64s(a: &dyn Array) -> Result<Vec<Option<i64>>> {
    use arrow_array::types::{Int16Type, Int32Type, Int64Type};
    if let Some(p) = a.as_primitive_opt::<Int16Type>() {
        return Ok(p.iter().map(|v| v.map(i64::from)).collect());
    }
    if let Some(p) = a.as_primitive_opt::<Int32Type>() {
        return Ok(p.iter().map(|v| v.map(i64::from)).collect());
    }
    Ok(a.as_primitive_opt::<Int64Type>().context("expected int")?.iter().collect())
}

