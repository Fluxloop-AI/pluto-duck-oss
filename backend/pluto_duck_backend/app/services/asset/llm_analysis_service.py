"""LLM-based dataset analysis service.

This module provides functions to analyze file diagnoses using LLM,
extracting context, potential analyses, and data quality issues.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from .file_diagnosis_service import (
    FileDiagnosis,
    IssueItem,
    LLMAnalysisResult,
    PotentialItem,
)
from .prompts import load_dataset_analysis_prompt

logger = logging.getLogger(__name__)

# Batch size for LLM calls - can be adjusted for token efficiency
LLM_BATCH_SIZE = 5


def format_diagnoses_for_llm(diagnoses: List[FileDiagnosis]) -> str:
    """Format file diagnoses as JSON for LLM input.

    Args:
        diagnoses: List of FileDiagnosis objects

    Returns:
        JSON string representing the diagnoses in LLM-friendly format
    """
    formatted = []
    for diag in diagnoses:
        file_info = {
            "file_path": diag.file_path,
            "file_name": os.path.basename(diag.file_path),
            "schema": [
                {"name": col.name, "type": col.type}
                for col in diag.schema
            ],
            "row_count": diag.row_count,
            "sample_rows": diag.sample_rows[:5],  # Limit to 5 rows
            "column_statistics": [
                {
                    "column_name": cs.column_name,
                    "semantic_type": cs.semantic_type,
                    "null_percentage": cs.null_percentage,
                }
                for cs in diag.column_statistics
            ],
        }
        formatted.append(file_info)

    return json.dumps(formatted, ensure_ascii=False, indent=2)


def parse_llm_response(
    response: str,
    diagnoses: List[FileDiagnosis],
    model_used: str,
) -> Dict[str, LLMAnalysisResult]:
    """Parse LLM JSON response into LLMAnalysisResult objects.

    Args:
        response: Raw LLM response (should be valid JSON)
        diagnoses: Original diagnoses to map results back
        model_used: Model identifier used for analysis

    Returns:
        Dict mapping file_path to LLMAnalysisResult
    """
    results: Dict[str, LLMAnalysisResult] = {}
    analyzed_at = datetime.now(UTC)

    try:
        # Strip any markdown code block markers
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.startswith("```"):
            clean_response = clean_response[3:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()

        data = json.loads(clean_response)

        # Handle single file response
        if "files" not in data and len(diagnoses) == 1:
            file_path = diagnoses[0].file_path
            results[file_path] = _parse_single_result(data, analyzed_at, model_used)
        # Handle multi-file response
        elif "files" in data:
            for file_data in data["files"]:
                file_path = file_data.get("file_path", "")
                if file_path:
                    results[file_path] = _parse_single_result(
                        file_data, analyzed_at, model_used
                    )
        else:
            # Fallback: try to match by order
            logger.warning("Unexpected LLM response format, attempting order-based matching")
            if isinstance(data, list):
                for i, file_data in enumerate(data):
                    if i < len(diagnoses):
                        file_path = diagnoses[i].file_path
                        results[file_path] = _parse_single_result(
                            file_data, analyzed_at, model_used
                        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        logger.debug(f"Response was: {response[:500]}...")
    except Exception as e:
        logger.error(f"Error parsing LLM response: {e}")

    return results


def _parse_single_result(
    data: Dict[str, Any],
    analyzed_at: datetime,
    model_used: str,
) -> LLMAnalysisResult:
    """Parse a single file's analysis result from JSON data.

    Args:
        data: JSON dict for one file's analysis
        analyzed_at: Timestamp to use
        model_used: Model identifier

    Returns:
        LLMAnalysisResult object
    """
    potential = [
        PotentialItem(
            question=p.get("question", ""),
            analysis=p.get("analysis", ""),
        )
        for p in data.get("potential", [])
    ]

    issues = [
        IssueItem(
            issue=i.get("issue", ""),
            suggestion=i.get("suggestion", ""),
        )
        for i in data.get("issues", [])
    ]

    return LLMAnalysisResult(
        suggested_name=data.get("suggested_name", "unnamed_dataset"),
        context=data.get("context", ""),
        potential=potential,
        issues=issues,
        analyzed_at=analyzed_at,
        model_used=model_used,
    )


async def analyze_batch_with_llm(
    diagnoses: List[FileDiagnosis],
    llm_provider: Any,
    model_name: str,
) -> Dict[str, LLMAnalysisResult]:
    """Analyze a batch of file diagnoses using LLM.

    Args:
        diagnoses: List of FileDiagnosis objects to analyze
        llm_provider: LLM provider instance with ainvoke method
        model_name: Name of the model being used

    Returns:
        Dict mapping file_path to LLMAnalysisResult
    """
    if not diagnoses:
        return {}

    # Format diagnoses for LLM
    input_json = format_diagnoses_for_llm(diagnoses)

    # Load and format prompt
    prompt_template = load_dataset_analysis_prompt()
    prompt = prompt_template.replace("{input_json}", input_json)

    # Call LLM
    try:
        logger.info(f"[LLM] Calling LLM for {len(diagnoses)} files...")
        response = await llm_provider.ainvoke(prompt)
        logger.info(f"[LLM] Raw response:\n{response}")

        results = parse_llm_response(response, diagnoses, model_name)

        # Log parsed results
        for file_path, result in results.items():
            logger.info(f"[LLM] Parsed result for {file_path}:")
            logger.info(f"  - suggested_name: {result.suggested_name}")
            logger.info(f"  - context: {result.context[:100]}..." if len(result.context) > 100 else f"  - context: {result.context}")
            logger.info(f"  - potential: {len(result.potential)} items")
            logger.info(f"  - issues: {len(result.issues)} items")

        return results
    except Exception as e:
        logger.error(f"[LLM] Analysis failed: {e}", exc_info=True)
        return {}


async def analyze_datasets_with_llm(
    diagnoses: List[FileDiagnosis],
    llm_provider: Optional[Any] = None,
) -> Dict[str, LLMAnalysisResult]:
    """Analyze multiple file diagnoses using LLM with batching.

    Splits diagnoses into batches of LLM_BATCH_SIZE and processes
    them in parallel using asyncio.gather().

    Args:
        diagnoses: List of FileDiagnosis objects to analyze
        llm_provider: Optional LLM provider. If None, uses get_llm_provider()

    Returns:
        Dict mapping file_path to LLMAnalysisResult for all analyzed files
    """
    if not diagnoses:
        return {}

    # Get LLM provider if not provided
    if llm_provider is None:
        from pluto_duck_backend.agent.core.llm.providers import get_llm_provider, MockLLMProvider
        from pluto_duck_backend.app.core.config import get_settings

        settings = get_settings()
        logger.info(f"[LLM DEBUG] mock_mode={settings.agent.mock_mode}, api_key={'SET' if settings.agent.api_key else 'NOT SET'}")

        llm_provider = get_llm_provider()
        logger.info(f"[LLM DEBUG] Provider type: {type(llm_provider).__name__}")

        if isinstance(llm_provider, MockLLMProvider):
            logger.warning("[LLM DEBUG] MockLLMProvider is being used! LLM analysis will not work properly.")

    # Get model name for tracking
    model_name = getattr(llm_provider, "_model", "unknown")

    # Split into batches
    batches: List[List[FileDiagnosis]] = []
    for i in range(0, len(diagnoses), LLM_BATCH_SIZE):
        batches.append(diagnoses[i : i + LLM_BATCH_SIZE])

    logger.info(
        f"Analyzing {len(diagnoses)} files in {len(batches)} batches "
        f"(batch size: {LLM_BATCH_SIZE})"
    )

    # Process batches in parallel
    tasks = [
        analyze_batch_with_llm(batch, llm_provider, model_name)
        for batch in batches
    ]
    batch_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge results
    all_results: Dict[str, LLMAnalysisResult] = {}
    for result in batch_results:
        if isinstance(result, Exception):
            logger.error(f"Batch analysis failed: {result}")
            continue
        if isinstance(result, dict):
            all_results.update(result)

    logger.info(f"LLM analysis completed: {len(all_results)}/{len(diagnoses)} files analyzed")
    return all_results
