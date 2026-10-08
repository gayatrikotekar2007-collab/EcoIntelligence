"""
Deterministic Action Verification Service.

Core Principles:
1. Evidence-first. Verification records whether recorded verification criteria were observed.
2. It does NOT establish or imply causality (i.e. does not claim the action caused the improvement).
3. Deterministic numeric evaluation only for supported operators and numeric values.
4. Non-numeric criteria require investigator-recorded results (no AI / NLP interpretations).
"""

from __future__ import annotations

import math
from typing import Optional, Sequence

from app.models.core import (
    ActionCriterion,
    ComparisonOperator,
    CriterionResult,
    MeasurementType,
    VerificationStatus,
)


def evaluate_numeric_criterion(
    operator: Optional[str],
    target_value: Optional[float],
    observed_value: Optional[float],
) -> Optional[str]:
    """
    Deterministically evaluates a numeric criterion against an observed value.

    Supported operators: LT, LTE, EQ, GTE, GT.
    Returns:
        "PASS", "FAIL", or None if evaluation is not possible.
    """
    if operator is None or target_value is None or observed_value is None:
        return None

    op = operator.upper()
    try:
        t_val = float(target_value)
        o_val = float(observed_value)
    except (ValueError, TypeError):
        return None

    if op == ComparisonOperator.LT.value:
        return CriterionResult.PASS.value if o_val < t_val else CriterionResult.FAIL.value
    elif op == ComparisonOperator.LTE.value:
        return CriterionResult.PASS.value if o_val <= t_val else CriterionResult.FAIL.value
    elif op == ComparisonOperator.EQ.value:
        return (
            CriterionResult.PASS.value
            if math.isclose(o_val, t_val, rel_tol=1e-9, abs_tol=1e-9)
            else CriterionResult.FAIL.value
        )
    elif op == ComparisonOperator.GTE.value:
        return CriterionResult.PASS.value if o_val >= t_val else CriterionResult.FAIL.value
    elif op == ComparisonOperator.GT.value:
        return CriterionResult.PASS.value if o_val > t_val else CriterionResult.FAIL.value

    return None


def determine_criterion_result(
    criterion: ActionCriterion,
    observed_value: Optional[float],
    investigator_result: Optional[str] = None,
) -> tuple[str, str]:
    """
    Evaluates a single criterion.

    Returns:
        tuple (result, evaluation_mode)
        where result is in {"PASS", "FAIL", "NOT_ASSESSED", "INCONCLUSIVE"}
        and evaluation_mode is in {"numeric_comparison", "investigator_recorded"}
    """
    # 1. Deterministic numeric comparison if applicable
    if (
        criterion.measurement_type == MeasurementType.NUMERIC.value
        and criterion.comparison_operator is not None
        and criterion.target_value is not None
        and observed_value is not None
    ):
        num_res = evaluate_numeric_criterion(
            criterion.comparison_operator,
            criterion.target_value,
            observed_value,
        )
        if num_res is not None:
            return num_res, "numeric_comparison"

    # 2. Investigator-recorded evaluation for qualitative/other criteria
    if investigator_result is not None:
        valid_results = {
            CriterionResult.PASS.value,
            CriterionResult.FAIL.value,
            CriterionResult.NOT_ASSESSED.value,
            CriterionResult.INCONCLUSIVE.value,
        }
        clean_res = investigator_result.upper()
        if clean_res in valid_results:
            return clean_res, "investigator_recorded"

    return CriterionResult.NOT_ASSESSED.value, "investigator_recorded"


def derive_verification_status(
    results: Sequence[str],
    explicit_status: Optional[str] = None,
) -> str:
    """
    Deterministically computes the summary verification status from individual criterion results,
    unless an explicit investigator status is provided.

    Rules:
    - If investigator supplied explicit status: authoritative.
    - All assessed criteria PASS (>= 1 assessed): VERIFIED
    - All assessed criteria FAIL (>= 1 assessed): NOT_VERIFIED
    - Mixture of PASS and FAIL: PARTIALLY_VERIFIED
    - No criteria or only NOT_ASSESSED/INCONCLUSIVE: INCONCLUSIVE
    """
    if explicit_status:
        valid_statuses = {
            VerificationStatus.PENDING.value,
            VerificationStatus.VERIFIED.value,
            VerificationStatus.PARTIALLY_VERIFIED.value,
            VerificationStatus.NOT_VERIFIED.value,
            VerificationStatus.INCONCLUSIVE.value,
        }
        if explicit_status.upper() in valid_statuses:
            return explicit_status.upper()

    assessed = [r for r in results if r in {CriterionResult.PASS.value, CriterionResult.FAIL.value}]
    if not assessed:
        return VerificationStatus.INCONCLUSIVE.value

    has_pass = any(r == CriterionResult.PASS.value for r in assessed)
    has_fail = any(r == CriterionResult.FAIL.value for r in assessed)

    if has_pass and not has_fail:
        return VerificationStatus.VERIFIED.value
    elif has_fail and not has_pass:
        return VerificationStatus.NOT_VERIFIED.value
    elif has_pass and has_fail:
        return VerificationStatus.PARTIALLY_VERIFIED.value

    return VerificationStatus.INCONCLUSIVE.value
