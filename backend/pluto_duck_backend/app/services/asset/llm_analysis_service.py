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
from typing import Dict, List

from pluto_duck_backend.app.services.llm import (
    BatchAnalysisSchema,
    FileAnalysisSchema,
    LLMService,
)

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


def _schema_to_result(
    file_schema: FileAnalysisSchema,
    analyzed_at: datetime,
    model_used: str,
) -> LLMAnalysisResult:
    """Convert Pydantic FileAnalysisSchema to dataclass LLMAnalysisResult.

    Args:
        file_schema: Pydantic schema from structured LLM output
        analyzed_at: Timestamp of analysis
        model_used: Model identifier

    Returns:
        LLMAnalysisResult dataclass
    """
    potential = [
        PotentialItem(question=p.question, analysis=p.analysis)
        for p in file_schema.potential
    ]
    issues = [
        IssueItem(issue=i.issue, suggestion=i.suggestion)
        for i in file_schema.issues
    ]

    return LLMAnalysisResult(
        suggested_name=file_schema.suggested_name,
        context=file_schema.context,
        potential=potential,
        issues=issues,
        analyzed_at=analyzed_at,
        model_used=model_used,
    )


async def analyze_batch_with_llm(
    diagnoses: List[FileDiagnosis],
    llm_service: LLMService,
) -> Dict[str, LLMAnalysisResult]:
    """Analyze a batch of file diagnoses using LLM with structured output.

    Args:
        diagnoses: List of FileDiagnosis objects to analyze
        llm_service: LLMService instance

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

    # Call LLM with structured output
    try:
        logger.info(f"[LLM] Calling LLM for {len(diagnoses)} files...")

        batch_result = await llm_service.complete_structured(
            prompt=prompt,
            response_schema=BatchAnalysisSchema,
        )

        logger.info(f"[LLM] Got structured response with {len(batch_result.files)} files")

        # Convert to results dict
        results: Dict[str, LLMAnalysisResult] = {}
        analyzed_at = datetime.now(UTC)
        model_used = llm_service.model_name

        for file_schema in batch_result.files:
            file_path = file_schema.file_path
            results[file_path] = _schema_to_result(file_schema, analyzed_at, model_used)

            logger.info(f"[LLM] Parsed result for {file_path}:")
            logger.info(f"  - suggested_name: {file_schema.suggested_name}")
            context_preview = (
                f"{file_schema.context[:100]}..."
                if len(file_schema.context) > 100
                else file_schema.context
            )
            logger.info(f"  - context: {context_preview}")
            logger.info(f"  - potential: {len(file_schema.potential)} items")
            logger.info(f"  - issues: {len(file_schema.issues)} items")

        return results
    except Exception as e:
        logger.error(f"[LLM] Analysis failed: {e}", exc_info=True)
        return {}


async def analyze_datasets_with_llm(
    diagnoses: List[FileDiagnosis],
    llm_service: LLMService | None = None,
) -> Dict[str, LLMAnalysisResult]:
    """Analyze multiple file diagnoses using LLM with batching.

    Splits diagnoses into batches of LLM_BATCH_SIZE and processes
    them in parallel using asyncio.gather().

    Args:
        diagnoses: List of FileDiagnosis objects to analyze
        llm_service: Optional LLMService instance. If None, creates a new one.

    Returns:
        Dict mapping file_path to LLMAnalysisResult for all analyzed files
    """
    if not diagnoses:
        return {}

    # Get LLM service if not provided
    if llm_service is None:
        llm_service = LLMService()
        logger.info(
            f"[LLM DEBUG] Using LLMService with model={llm_service.model_name}, "
            f"provider={llm_service.provider_name}"
        )

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
        analyze_batch_with_llm(batch, llm_service)
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
