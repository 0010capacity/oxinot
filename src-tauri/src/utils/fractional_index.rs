/// Calculate the middle value between two order weights
pub fn calculate_middle(before: Option<f64>, after: Option<f64>) -> f64 {
    match (before, after) {
        (None, None) => 1.0,
        (None, Some(a)) => a / 2.0,
        (Some(b), None) => b + 1.0,
        (Some(b), Some(a)) => (b + a) / 2.0,
    }
}

/// Calculate order weights for multiple block insertions with even distribution
pub fn calculate_between(before: Option<f64>, after: Option<f64>, count: usize) -> Vec<f64> {
    let start = before.unwrap_or(0.0);
    let end = after.unwrap_or(start + count as f64 + 1.0);
    let step = (end - start) / (count + 1) as f64;

    (1..=count).map(|i| start + step * i as f64).collect()
}

/// Check if rebalancing is needed due to floating point precision limits
pub fn needs_rebalancing(before: f64, after: f64) -> bool {
    (after - before).abs() < 1e-10
}

/// Generate a fresh set of order weights for rebalancing
pub fn rebalance_order_weights(count: usize) -> Vec<f64> {
    (1..=count).map(|i| i as f64).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_middle_both_none() {
        assert_eq!(calculate_middle(None, None), 1.0);
    }

    #[test]
    fn test_calculate_middle_before_none() {
        assert_eq!(calculate_middle(None, Some(4.0)), 2.0);
    }

    #[test]
    fn test_calculate_middle_after_none() {
        assert_eq!(calculate_middle(Some(3.0), None), 4.0);
    }

    #[test]
    fn test_calculate_middle_both_some() {
        assert_eq!(calculate_middle(Some(1.0), Some(2.0)), 1.5);
    }

    #[test]
    fn test_calculate_between() {
        let result = calculate_between(Some(1.0), Some(2.0), 1);
        assert_eq!(result.len(), 1);
        assert!(result[0] > 1.0 && result[0] < 2.0);
    }

    #[test]
    fn test_rebalance_order_weights() {
        let result = rebalance_order_weights(3);
        assert_eq!(result, vec![1.0, 2.0, 3.0]);
    }

    #[test]
    fn test_needs_rebalancing() {
        assert!(needs_rebalancing(1.0, 1.0000000001));
        assert!(!needs_rebalancing(1.0, 1.5));
    }
}
