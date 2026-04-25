use crate::error::AppError;
use rand::distr::{Distribution, Uniform};
use rand::seq::SliceRandom;
use rand_chacha::ChaCha20Rng;
use rand::SeedableRng;
use rand::TryRngCore;

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    #[test]
    fn rng_from_hex_is_deterministic() {
        let seed = "0000000000000000000000000000000000000000000000000000000000000000";
        let mut a = rng_from_hex(seed).unwrap();
        let mut b = rng_from_hex(seed).unwrap();

        let mut out_a = [0u8; 64];
        let mut out_b = [0u8; 64];
        a.fill_bytes(&mut out_a);
        b.fill_bytes(&mut out_b);
        assert_eq!(out_a, out_b);
    }

    #[test]
    fn different_seeds_produce_different_streams() {
        let seed_a = "0000000000000000000000000000000000000000000000000000000000000000";
        let seed_b = "0000000000000000000000000000000000000000000000000000000000000001";
        let mut a = rng_from_hex(seed_a).unwrap();
        let mut b = rng_from_hex(seed_b).unwrap();

        let mut out_a = [0u8; 64];
        let mut out_b = [0u8; 64];
        a.fill_bytes(&mut out_a);
        b.fill_bytes(&mut out_b);
        assert_ne!(out_a, out_b);
    }

    #[test]
    fn rng_from_hex_rejects_invalid_seed() {
        assert!(matches!(
            rng_from_hex(""),
            Err(AppError::InvalidSeed { .. })
        ));
        assert!(matches!(
            rng_from_hex("short"),
            Err(AppError::InvalidSeed { .. })
        ));
        assert!(matches!(
            rng_from_hex("gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg"),
            Err(AppError::InvalidSeed { .. })
        ));
        assert!(matches!(
            rng_from_hex("0"),
            Err(AppError::InvalidSeed { .. })
        ));
    }

    #[test]
    fn shuffle_preserves_elements_and_is_deterministic() {
        let seed = "1111111111111111111111111111111111111111111111111111111111111111";
        let items = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        let a = shuffle_with_seed(&items, seed).unwrap();
        let b = shuffle_with_seed(&items, seed).unwrap();
        assert_eq!(a, b);

        let mut sorted = a.clone();
        sorted.sort();
        assert_eq!(sorted, items);
    }

    #[test]
    fn draw_without_replacement_returns_unique_entries() {
        let seed = "2222222222222222222222222222222222222222222222222222222222222222";
        let pool = vec![10, 20, 30, 40, 50];

        let winners = draw_without_replacement(&pool, 3, seed).unwrap();
        assert_eq!(winners.len(), 3);
        let mut uniq = winners.clone();
        uniq.sort();
        uniq.dedup();
        assert_eq!(uniq.len(), 3);
        assert!(winners.iter().all(|w| pool.contains(w)));
    }

    #[test]
    fn draw_without_replacement_rejects_n_gt_len() {
        let seed = "3333333333333333333333333333333333333333333333333333333333333333";
        let pool = vec![1, 2, 3];
        assert!(matches!(
            draw_without_replacement(&pool, 4, seed),
            Err(AppError::InvalidInput { .. })
        ));
    }

    #[test]
    fn draw_with_replacement_allows_duplicates_and_validates_pool() {
        let seed = "4444444444444444444444444444444444444444444444444444444444444444";
        let pool = vec![1, 2];

        let winners = draw_with_replacement(&pool, 10, seed).unwrap();
        assert_eq!(winners.len(), 10);
        assert!(winners.iter().all(|w| pool.contains(w)));
        assert!(winners.iter().copied().collect::<std::collections::HashSet<_>>().len() < 10);

        assert!(matches!(
            draw_with_replacement::<i32>(&[], 1, seed),
            Err(AppError::InvalidInput { .. })
        ));
    }

    #[test]
    fn generate_seed_bytes_has_reasonable_uniqueness() {
        let mut seeds = std::collections::HashSet::new();
        for _ in 0..32 {
            let s = seed_to_hex(&generate_seed_bytes().unwrap());
            assert_eq!(s.len(), 64);
            assert!(s.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
            seeds.insert(s);
        }
        assert_eq!(seeds.len(), 32);
    }

    #[test]
    fn golden_vector_v2_shuffle_is_stable() {
        let seed = "0000000000000000000000000000000000000000000000000000000000000000";
        let items = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        // This vector is expected to be locked once implementation lands.
        // For now it just asserts a concrete order to prevent accidental changes later.
        let shuffled = shuffle_with_seed(&items, seed).unwrap();
        assert_eq!(shuffled, vec![7, 2, 1, 0, 4, 8, 9, 6, 5, 3]);
    }
}

// Production API
pub fn generate_seed_bytes() -> Result<[u8; 32], AppError> {
    let mut seed = [0u8; 32];
    let mut rng = rand::rngs::OsRng;
    rng.try_fill_bytes(&mut seed)
        .map_err(|_| AppError::internal("Failed to read from OS RNG."))?;
    Ok(seed)
}

pub fn seed_to_hex(seed: &[u8; 32]) -> String {
    hex::encode(seed)
}

pub fn rng_from_hex(seed_hex: &str) -> Result<ChaCha20Rng, AppError> {
    let bytes = parse_seed_hex(seed_hex)?;
    Ok(ChaCha20Rng::from_seed(bytes))
}

#[cfg(test)]
fn shuffle_with_seed<T: Clone>(items: &[T], seed_hex: &str) -> Result<Vec<T>, AppError> {
    let mut rng = rng_from_hex(seed_hex)?;
    let mut out = items.to_vec();
    out.shuffle(&mut rng);
    Ok(out)
}

pub fn draw_without_replacement<T: Clone>(
    pool: &[T],
    n: usize,
    seed_hex: &str,
) -> Result<Vec<T>, AppError> {
    if pool.is_empty() {
        return Err(AppError::invalid_input("Inga deltagare att dra."));
    }
    if n > pool.len() {
        return Err(AppError::invalid_input(
            "Kan inte dra fler vinnare än antalet deltagare utan återläggning.",
        ));
    }
    let mut rng = rng_from_hex(seed_hex)?;
    let mut out = pool.to_vec();
    // Faster than full shuffle when n << len, but still deterministic.
    out.partial_shuffle(&mut rng, n);
    out.truncate(n);
    Ok(out)
}

pub fn draw_with_replacement<T: Clone>(
    pool: &[T],
    n: usize,
    seed_hex: &str,
) -> Result<Vec<T>, AppError> {
    if pool.is_empty() {
        return Err(AppError::invalid_input("Inga deltagare att dra."));
    }
    let mut rng = rng_from_hex(seed_hex)?;
    let dist = Uniform::new(0, pool.len())
        .map_err(|_| AppError::internal("Failed to create uniform distribution."))?;
    let mut winners = Vec::with_capacity(n);
    for _ in 0..n {
        let idx = dist.sample(&mut rng);
        winners.push(pool[idx].clone());
    }
    Ok(winners)
}

pub fn simulate_synthetic_draws(
    num_outcomes: u32,
    sample_size: usize,
    seed_hex: &str,
) -> Result<Vec<u32>, AppError> {
    if num_outcomes < 2 {
        return Err(AppError::invalid_input(
            "Antal möjliga utfall måste vara minst 2.",
        ));
    }
    if sample_size == 0 {
        return Err(AppError::invalid_input(
            "Antal dragningar måste vara större än 0.",
        ));
    }
    let mut rng = rng_from_hex(seed_hex)?;
    // Outcomes are 1..=num_outcomes (inclusive), matching the testing plan style.
    let dist = Uniform::new_inclusive(1u32, num_outcomes).map_err(|_| {
        AppError::internal("Failed to create uniform distribution for synthetic draws.")
    })?;
    let mut draws = Vec::with_capacity(sample_size);
    for _ in 0..sample_size {
        draws.push(dist.sample(&mut rng));
    }
    Ok(draws)
}

fn parse_seed_hex(seed_hex: &str) -> Result<[u8; 32], AppError> {
    if seed_hex.len() != 64 {
        return Err(AppError::invalid_seed(
            "Ogiltig slumpseed: måste vara 64 hex-tecken (32 bytes).",
        ));
    }
    let decoded = hex::decode(seed_hex).map_err(|_| {
        AppError::invalid_seed("Ogiltig slumpseed: endast hexadecimala tecken tillåtna.")
    })?;
    let bytes: [u8; 32] = decoded.try_into().map_err(|_| {
        AppError::invalid_seed("Ogiltig slumpseed: måste vara exakt 32 bytes.")
    })?;
    Ok(bytes)
}

