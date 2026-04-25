// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Migration, MigrationKind};

mod error;
mod random;
mod randomness;

use error::AppError;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn generate_seed() -> Result<String, AppError> {
    let seed = random::generate_seed_bytes()?;
    Ok(random::seed_to_hex(&seed))
}

#[tauri::command]
fn draw_winners(
    participant_ids: Vec<i64>,
    num_draws: usize,
    with_replacement: bool,
    seed: String,
) -> Result<Vec<i64>, AppError> {
    if participant_ids.is_empty() {
        return Err(AppError::invalid_input("Inga deltagare att dra."));
    }
    if !with_replacement && num_draws > participant_ids.len() {
        return Err(AppError::invalid_input(
            "Kan inte dra fler vinnare än antalet deltagare utan återläggning.",
        ));
    }

    let winners = if with_replacement {
        random::draw_with_replacement(&participant_ids, num_draws, &seed)?
    } else {
        random::draw_without_replacement(&participant_ids, num_draws, &seed)?
    };
    Ok(winners)
}

#[tauri::command]
fn simulate_synthetic_draws(
    num_outcomes: u32,
    sample_size: usize,
    seed: String,
) -> Result<Vec<u32>, AppError> {
    random::simulate_synthetic_draws(num_outcomes, sample_size, &seed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_randomness_tests",
            sql: include_str!("../migrations/0002_randomness_tests.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_seed,
            draw_winners,
            simulate_synthetic_draws,
            randomness::run_randomness_tests
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
