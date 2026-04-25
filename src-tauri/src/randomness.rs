use crate::error::AppError;

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct RandomnessReport {
    pub chi_square_stat: f64,
    pub chi_square_p: f64,
    pub chi_square_passed: bool,
    pub runs_stat: f64,
    pub runs_p: f64,
    pub runs_passed: bool,
    pub serial_correlation: f64,
    pub frequency: Vec<u32>,
    pub sample_size: usize,
    pub overall_passed: bool,
}

#[tauri::command]
pub fn run_randomness_tests(
    draws: Vec<u32>,
    min_val: u32,
    max_val: u32,
) -> Result<RandomnessReport, AppError> {
    if draws.is_empty() {
        return Err(AppError::invalid_input("Inga dragningar att testa."));
    }
    if min_val > max_val {
        return Err(AppError::invalid_input(
            "Ogiltigt intervall: min-värde måste vara <= max-värde.",
        ));
    }

    let k = (max_val - min_val + 1) as usize;
    if k < 2 {
        return Err(AppError::invalid_input(
            "Antal möjliga utfall måste vara minst 2.",
        ));
    }

    let n = draws.len();
    if n < 5 * k {
        return Err(AppError::invalid_input(format!(
            "För få dragningar för meningsfullt test. Behöver minst {} (5×{}), fick {}.",
            5 * k,
            k,
            n
        )));
    }

    let mut freq = vec![0u32; k];
    for &v in &draws {
        if v < min_val || v > max_val {
            return Err(AppError::invalid_input(
                "Dragningar innehåller värden utanför angivet intervall.",
            ));
        }
        freq[(v - min_val) as usize] += 1;
    }

    let (chi_stat, chi_p, chi_passed) = chi_square_uniform(&freq, n)?;
    let (runs_z, runs_p, runs_passed) = runs_test_median_split(&draws, min_val, max_val)?;
    let serial = serial_correlation(&draws);

    // Conservative thresholds to avoid flaky results in CI.
    let serial_passed = serial.abs() < 0.05;
    let overall_passed = chi_passed && runs_passed && serial_passed;

    Ok(RandomnessReport {
        chi_square_stat: chi_stat,
        chi_square_p: chi_p,
        chi_square_passed: chi_passed,
        runs_stat: runs_z,
        runs_p,
        runs_passed,
        serial_correlation: serial,
        frequency: freq,
        sample_size: n,
        overall_passed,
    })
}

fn chi_square_uniform(freq: &[u32], n: usize) -> Result<(f64, f64, bool), AppError> {
    let k = freq.len();
    let expected = (n as f64) / (k as f64);
    if expected <= 0.0 {
        return Err(AppError::invalid_input("Ogiltig sample size."));
    }

    let mut stat = 0.0;
    for &obs in freq {
        let diff = (obs as f64) - expected;
        stat += (diff * diff) / expected;
    }

    let df = (k as f64) - 1.0;
    let p = chi_square_p_value(stat, df);
    let passed = p >= 0.01;
    Ok((stat, p, passed))
}

fn runs_test_median_split(
    draws: &[u32],
    min_val: u32,
    max_val: u32,
) -> Result<(f64, f64, bool), AppError> {
    if draws.len() < 2 {
        return Err(AppError::invalid_input("För få dragningar för runs-test."));
    }

    let median = ((min_val as f64) + (max_val as f64)) / 2.0;
    let mut prev = (draws[0] as f64) > median;
    let mut runs = 1usize;
    let mut n1 = if prev { 1usize } else { 0usize };
    let mut n0 = if prev { 0usize } else { 1usize };

    for &v in &draws[1..] {
        let cur = (v as f64) > median;
        if cur != prev {
            runs += 1;
            prev = cur;
        }
        if cur {
            n1 += 1;
        } else {
            n0 += 1;
        }
    }

    if n0 == 0 || n1 == 0 {
        // Degenerate: all values are on the same side.
        return Ok((f64::INFINITY, 0.0, false));
    }

    let n = draws.len() as f64;
    let n0f = n0 as f64;
    let n1f = n1 as f64;

    let mu = (2.0 * n0f * n1f) / n + 1.0;
    let var = (2.0 * n0f * n1f * (2.0 * n0f * n1f - n)) / (n * n * (n - 1.0));
    if var <= 0.0 {
        return Ok((0.0, 1.0, true));
    }
    let z = ((runs as f64) - mu) / var.sqrt();
    let p = 2.0 * (1.0 - standard_normal_cdf(z.abs()));
    let passed = p >= 0.01;
    Ok((z, p, passed))
}

fn serial_correlation(draws: &[u32]) -> f64 {
    if draws.len() < 2 {
        return 0.0;
    }
    let n = draws.len() as f64;
    let mean = draws.iter().map(|&x| x as f64).sum::<f64>() / n;

    let mut num = 0.0;
    let mut den = 0.0;
    for i in 0..(draws.len() - 1) {
        let a = (draws[i] as f64) - mean;
        let b = (draws[i + 1] as f64) - mean;
        num += a * b;
        den += a * a;
    }
    if den <= 0.0 {
        0.0
    } else {
        num / den
    }
}

fn chi_square_p_value(x: f64, df: f64) -> f64 {
    if !x.is_finite() || x < 0.0 || df <= 0.0 {
        return 0.0;
    }

    // Wilson–Hilferty transformation (upper tail)
    let a = 1.0 - 2.0 / (9.0 * df);
    let b = ((x / df).powf(1.0 / 3.0) - a) / (2.0 / (9.0 * df)).sqrt();
    let cdf = standard_normal_cdf(b);
    (1.0 - cdf).clamp(0.0, 1.0)
}

fn standard_normal_cdf(z: f64) -> f64 {
    // Φ(z) = 1/2 * (1 + erf(z / sqrt(2)))
    let t = z / std::f64::consts::SQRT_2;
    0.5 * (1.0 + libm::erf(t))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perfect_uniform_passes() {
        // 10 000 dragningar jämnt fördelade över 1-10
        let draws: Vec<u32> = (1..=10).cycle().take(10_000).collect();
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(r.chi_square_passed);
        // Ordering is not random here (sorted cycle), so runs/serial are expected to fail.
    }

    #[test]
    fn sorted_sequence_fails_runs() {
        let draws: Vec<u32> = (1..=10).cycle().take(10_000).collect();
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(!r.runs_passed);
        assert!(!r.overall_passed);
    }

    #[test]
    fn heavy_bias_fails() {
        // 90% av dragningarna är talet 5
        let mut draws = vec![5u32; 9_000];
        draws.extend((1..=10).cycle().take(1_000));
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(!r.chi_square_passed);
        assert!(!r.overall_passed);
    }

    #[test]
    fn too_few_samples_returns_error() {
        let draws = (1..=10).cycle().take(10).collect::<Vec<u32>>();
        assert!(run_randomness_tests(draws, 1, 10).is_err());
    }

    #[test]
    fn chacha20_real_output_passes_all_tests() {
        let seed = "0000000000000000000000000000000000000000000000000000000000000000";
        let draws = crate::random::simulate_synthetic_draws(10, 10_000, seed).unwrap();
        let r = run_randomness_tests(draws, 1, 10).unwrap();
        assert!(r.overall_passed);
    }
}

