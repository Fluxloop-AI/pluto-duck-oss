'use client';

import { X, AlertTriangle, ArrowRight, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { DatasetCard, type Dataset } from './DatasetCard';
import { AgentRecommendation } from './AgentRecommendation';
import type { FileDiagnosis, ColumnSchema, TypeSuggestion, DuplicateCountResponse, MergedAnalysis } from '../../lib/fileAssetApi';

interface SelectedFile {
  id: string;
  name: string;
  path: string | null;
  file?: File;
}

interface DiagnosisResultViewProps {
  diagnoses: FileDiagnosis[];
  files: SelectedFile[];
  onBack: () => void;
  onImport: (datasetNames: Record<number, string>) => void;
  onClose: () => void;
  isImporting: boolean;
  schemasMatch: boolean;
  mergeFiles: boolean;
  onMergeFilesChange: (checked: boolean) => void;
  removeDuplicates: boolean;
  onRemoveDuplicatesChange: (checked: boolean) => void;
  duplicateInfo: DuplicateCountResponse | null;
  mergedAnalysis: MergedAnalysis | null;
}

// Helper to format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Helper to get file name from path
function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

// Helper to generate a valid table name from filename
function generateTableName(filename: string): string {
  const nameWithoutExt = filename.replace(/\.(csv|parquet)$/i, '');
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 63);
}

// Determine dataset status based on diagnosis
function determineStatus(diagnosis: FileDiagnosis): 'ready' | 'review' {
  if (!diagnosis.llm_analysis) return 'review';
  if (diagnosis.llm_analysis.issues.length > 0) return 'review';
  return 'ready';
}

// Single file diagnosis card (expandable schema table)
interface FileDiagnosisCardProps {
  diagnosis: FileDiagnosis;
  isExpanded: boolean;
  onToggle: () => void;
}

function FileDiagnosisCard({ diagnosis, isExpanded, onToggle }: FileDiagnosisCardProps) {
  const fileName = getFileName(diagnosis.file_path);
  const hasIssues = Object.keys(diagnosis.missing_values).length > 0 || diagnosis.type_suggestions.length > 0;
  const totalMissingValues = Object.values(diagnosis.missing_values).reduce((sum, count) => sum + count, 0);

  // Create a map of type suggestions by column name
  const suggestionsByColumn: Record<string, TypeSuggestion> = {};
  for (const suggestion of diagnosis.type_suggestions) {
    suggestionsByColumn[suggestion.column_name] = suggestion;
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <FileText size={20} strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(diagnosis.row_count)} rows, {diagnosis.columns.length} columns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasIssues && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
              <AlertTriangle size={12} />
              {totalMissingValues > 0 && <span>{formatNumber(totalMissingValues)} nulls</span>}
              {diagnosis.type_suggestions.length > 0 && (
                <span>{diagnosis.type_suggestions.length} type hint{diagnosis.type_suggestions.length > 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          {isExpanded ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Card Content - Schema Table */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Column</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nullable</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Issues</th>
                </tr>
              </thead>
              <tbody>
                {diagnosis.columns.map((column: ColumnSchema) => {
                  const missingCount = diagnosis.missing_values[column.name] || 0;
                  const suggestion = suggestionsByColumn[column.name];
                  const hasColumnIssue = missingCount > 0 || suggestion;

                  return (
                    <tr
                      key={column.name}
                      className={hasColumnIssue ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                    >
                      <td className="px-4 py-2 font-mono text-foreground">{column.name}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">{column.type}</span>
                          {suggestion && (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <ArrowRight size={12} />
                              <span className="font-mono">{suggestion.suggested_type}</span>
                              <span className="text-muted-foreground">({Math.round(suggestion.confidence)}%)</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {column.nullable ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-2">
                        {missingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs">
                            <AlertTriangle size={10} />
                            {formatNumber(missingCount)} null{missingCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function DiagnosisResultView({
  diagnoses,
  files,
  onBack,
  onImport,
  onClose,
  isImporting,
  schemasMatch,
  mergeFiles,
  onMergeFilesChange,
  removeDuplicates,
  onRemoveDuplicatesChange,
  duplicateInfo,
  mergedAnalysis,
}: DiagnosisResultViewProps) {
  // Track which schema cards are expanded
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);

  // Name editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [datasetNames, setDatasetNames] = useState<Record<number, string>>({});

  const totalFiles = diagnoses.length;
  const totalRows = diagnoses.reduce((sum, d) => sum + d.row_count, 0);

  // Show AgentRecommendation when schemas match and 2+ files
  const showAgentRecommendation = schemasMatch && diagnoses.length >= 2;

  // Convert diagnoses to Dataset objects for individual files
  const datasets: Dataset[] = useMemo(() => {
    return diagnoses.map((d, i) => ({
      id: i,
      name: datasetNames[i] || d.llm_analysis?.suggested_name || generateTableName(getFileName(d.file_path)),
      status: determineStatus(d),
      description: d.llm_analysis?.context || '',
      files: [getFileName(d.file_path)],
    }));
  }, [diagnoses, datasetNames]);

  // Create merged dataset
  const mergedDataset: Dataset = useMemo(() => {
    return {
      id: 0,
      name: datasetNames[0] || mergedAnalysis?.suggested_name || 'merged_dataset',
      status: 'ready',
      description: mergedAnalysis?.context || '',
      files: diagnoses.map(d => getFileName(d.file_path)),
    };
  }, [diagnoses, mergedAnalysis, datasetNames]);

  // Name editing handlers
  const startEditing = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = (id: number) => {
    setDatasetNames(prev => ({ ...prev, [id]: editName }));
    setEditingId(null);
  };

  const handleImport = () => {
    onImport(datasetNames);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border">
        <div>
          <h3 className="text-xl font-semibold text-foreground">
            {totalFiles}개 파일 스캔 완료
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2 rounded-lg hover:bg-muted"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-4">
        {/* Agent Recommendation - shown when schemas match */}
        {showAgentRecommendation && (
          <AgentRecommendation
            fileCount={diagnoses.length}
            totalRows={duplicateInfo?.total_rows || totalRows}
            duplicateRows={duplicateInfo?.duplicate_rows || 0}
            estimatedRows={duplicateInfo?.estimated_rows || totalRows}
            isMerged={mergeFiles}
            removeDuplicates={removeDuplicates}
            onMergeChange={onMergeFilesChange}
            onRemoveDuplicatesChange={onRemoveDuplicatesChange}
          />
        )}

        {/* Dataset Cards */}
        {showAgentRecommendation && mergeFiles ? (
          // Merged view: single card
          <div className="space-y-4">
            <DatasetCard
              dataset={mergedDataset}
              isEditing={editingId === 0}
              editName={editName}
              onStartEdit={startEditing}
              onSaveEdit={saveEdit}
              onEditNameChange={setEditName}
            />

            {/* Expandable schema details */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">파일 상세 정보</p>
              <div className="space-y-2">
                {diagnoses.map((diagnosis, index) => (
                  <FileDiagnosisCard
                    key={diagnosis.file_path}
                    diagnosis={diagnosis}
                    isExpanded={expandedIndex === index}
                    onToggle={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Individual datasets view
          <div className="space-y-4">
            {datasets.map((dataset, index) => (
              <div key={dataset.id}>
                <DatasetCard
                  dataset={dataset}
                  isEditing={editingId === dataset.id}
                  editName={editName}
                  onStartEdit={startEditing}
                  onSaveEdit={saveEdit}
                  onEditNameChange={setEditName}
                />

                {/* Expandable schema details per card */}
                <div className="mt-2">
                  <FileDiagnosisCard
                    diagnosis={diagnoses[index]}
                    isExpanded={expandedIndex === index}
                    onToggle={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-8 pt-4 pb-8 flex items-center justify-between border-t border-border">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={isImporting}
          className="px-6 py-3.5 rounded-xl"
        >
          Back
        </Button>

        <Button
          onClick={handleImport}
          disabled={isImporting}
          className="px-8 py-3.5 rounded-xl font-semibold"
        >
          {isImporting ? 'Creating...' : 'Create Datasets'}
        </Button>
      </div>
    </div>
  );
}
