use regex::Regex;

/// URL validator for secure shell operations
/// Restricts shell:open to safe URL schemes only
pub struct UrlValidator;

impl UrlValidator {
    /// List of allowed URL schemes for shell:open
    const ALLOWED_SCHEMES: &'static [&'static str] = &["https", "http", "mailto", "file"];

    /// Validate a URL for shell:open operation
    ///
    /// # Arguments
    /// * `url` - URL string to validate
    ///
    /// # Returns
    /// Ok(()) if URL is safe, Err with message if invalid or dangerous
    pub fn validate(url: &str) -> Result<(), String> {
        // Check for empty URL
        if url.is_empty() {
            return Err("URL cannot be empty".to_string());
        }

        // Check for null bytes
        if url.contains('\0') {
            return Err("URL contains null bytes".to_string());
        }

        // Check length to prevent DoS attacks
        if url.len() > 2048 {
            return Err("URL is too long (max 2048 characters)".to_string());
        }

        // Extract scheme
        let scheme = Self::extract_scheme(url)?;

        // Check if scheme is allowed
        if !Self::ALLOWED_SCHEMES.contains(&scheme) {
            return Err(format!(
                "URL scheme '{}' not allowed. Allowed schemes: {}",
                scheme,
                Self::ALLOWED_SCHEMES.join(", ")
            ));
        }

        // Additional validation for specific schemes
        match scheme {
            "https" | "http" => Self::validate_web_url(url)?,
            "mailto" => Self::validate_mailto_url(url)?,
            "file" => Self::validate_file_url(url)?,
            _ => return Err("Unknown scheme".to_string()),
        }

        Ok(())
    }

    /// Extract URL scheme
    fn extract_scheme(url: &str) -> Result<&str, String> {
        if let Some(pos) = url.find("://") {
            let scheme = &url[..pos];

            // Validate scheme format (alphanumeric + hyphen)
            if scheme
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-')
            {
                Ok(scheme)
            } else {
                Err("Invalid scheme format".to_string())
            }
        } else if let Some(pos) = url.find(':') {
            // Handle schemes without ://  (like mailto:)
            let scheme = &url[..pos];
            if scheme
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-')
            {
                Ok(scheme)
            } else {
                Err("Invalid scheme format".to_string())
            }
        } else {
            Err("URL must have a valid scheme".to_string())
        }
    }

    /// Validate web URLs (http, https)
    fn validate_web_url(url: &str) -> Result<(), String> {
        // Check for javascript: or data: URLs that might be injected
        if url.to_lowercase().contains("javascript:") || url.to_lowercase().contains("data:") {
            return Err("JavaScript and data URLs are not allowed".to_string());
        }

        // Basic URL format check using regex
        let url_regex = Regex::new(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+$")
            .map_err(|_| "Regex compilation failed".to_string())?;

        if !url_regex.is_match(url) {
            return Err("Invalid URL format".to_string());
        }

        Ok(())
    }

    /// Validate mailto URLs
    fn validate_mailto_url(url: &str) -> Result<(), String> {
        // mailto:email@example.com or mailto:email@example.com?subject=...
        if !url.starts_with("mailto:") {
            return Err("Invalid mailto URL format".to_string());
        }

        let email_part = &url[7..]; // Skip "mailto:"

        if email_part.is_empty() {
            return Err("mailto URL must have an email address".to_string());
        }

        // Extract email (before ? if present)
        let email = email_part.split('?').next().unwrap_or("");

        // Basic email validation (very permissive)
        if !email.contains('@') || email.len() < 3 {
            return Err("Invalid email address in mailto URL".to_string());
        }

        // Check for dangerous characters in query parameters
        if let Some(query) = email_part.split('?').nth(1) {
            if query.contains(';') || query.contains('\n') || query.contains('\r') {
                return Err("Invalid characters in mailto parameters".to_string());
            }
        }

        Ok(())
    }

    /// Validate file URLs (file://)
    fn validate_file_url(url: &str) -> Result<(), String> {
        // file:// URLs should only allow local filesystem access
        if !url.starts_with("file://") {
            return Err("Invalid file URL format".to_string());
        }

        // Check for path traversal attempts
        if url.contains("..") {
            return Err("Path traversal in file URLs not allowed".to_string());
        }

        // Check for suspicious patterns
        if url.to_lowercase().contains("etc/passwd")
            || url.to_lowercase().contains("windows/system32")
            || url.to_lowercase().contains("winnt/system32")
        {
            return Err("Access to system files not allowed".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_https_url() {
        assert!(UrlValidator::validate("https://github.com/0010capacity/oxinot").is_ok());
    }

    #[test]
    fn test_valid_http_url() {
        assert!(UrlValidator::validate("http://example.com").is_ok());
    }

    #[test]
    fn test_valid_mailto_url() {
        assert!(UrlValidator::validate("mailto:test@example.com").is_ok());
    }

    #[test]
    fn test_valid_mailto_with_subject() {
        assert!(UrlValidator::validate("mailto:test@example.com?subject=Hello").is_ok());
    }

    #[test]
    fn test_empty_url() {
        assert!(UrlValidator::validate("").is_err());
    }

    #[test]
    fn test_null_byte_in_url() {
        assert!(UrlValidator::validate("https://example.com\0evil.com").is_err());
    }

    #[test]
    fn test_url_too_long() {
        let long_url = "https://example.com/".to_string() + &"a".repeat(2050);
        assert!(UrlValidator::validate(&long_url).is_err());
    }

    #[test]
    fn test_javascript_url_blocked() {
        assert!(UrlValidator::validate("javascript:alert('xss')").is_err());
    }

    #[test]
    fn test_data_url_blocked() {
        assert!(UrlValidator::validate("data:text/html,<script>alert('xss')</script>").is_err());
    }

    #[test]
    fn test_file_url_with_path_traversal_blocked() {
        assert!(UrlValidator::validate("file:///etc/../etc/passwd").is_err());
    }

    #[test]
    fn test_ftp_url_blocked() {
        assert!(UrlValidator::validate("ftp://example.com").is_err());
    }

    #[test]
    fn test_gopher_url_blocked() {
        assert!(UrlValidator::validate("gopher://example.com").is_err());
    }

    #[test]
    fn test_mailto_without_email() {
        assert!(UrlValidator::validate("mailto:").is_err());
    }

    #[test]
    fn test_mailto_invalid_email() {
        assert!(UrlValidator::validate("mailto:notanemail").is_err());
    }

    #[test]
    fn test_file_url_valid() {
        assert!(UrlValidator::validate("file:///path/to/file.txt").is_ok());
    }

    #[test]
    fn test_file_url_system_file_blocked() {
        assert!(UrlValidator::validate("file:///etc/passwd").is_err());
    }
}
