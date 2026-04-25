use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Clone)]
#[serde(tag = "code", content = "details")]
pub enum AppError {
    #[error("{message}")]
    InvalidSeed { message: String },

    #[error("{message}")]
    InvalidInput { message: String },

    #[error("{message}")]
    Internal { message: String },
}

impl AppError {
    pub fn invalid_seed(message: impl Into<String>) -> Self {
        Self::InvalidSeed {
            message: message.into(),
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::InvalidInput {
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
}

