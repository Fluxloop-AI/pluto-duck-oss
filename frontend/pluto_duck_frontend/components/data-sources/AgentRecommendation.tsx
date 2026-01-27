'use client';

import { Sparkles, Check } from 'lucide-react';

// Helper to format number with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

interface AgentRecommendationProps {
  fileCount: number;
  totalRows: number;
  duplicateRows: number;
  estimatedRows: number;
  isMerged: boolean;
  removeDuplicates: boolean;
  onMergeChange: (checked: boolean) => void;
  onRemoveDuplicatesChange: (checked: boolean) => void;
}

export function AgentRecommendation({
  fileCount,
  totalRows,
  duplicateRows,
  estimatedRows,
  isMerged,
  removeDuplicates,
  onMergeChange,
  onRemoveDuplicatesChange,
}: AgentRecommendationProps) {
  const toggleMerge = () => {
    const newMerged = !isMerged;
    onMergeChange(newMerged);
    // merge 해제하면 remove duplicates도 해제
    if (!newMerged) {
      onRemoveDuplicatesChange(false);
    }
  };

  const toggleRemoveDuplicates = () => {
    // merge가 체크되어 있을 때만 토글 가능
    if (isMerged) {
      onRemoveDuplicatesChange(!removeDuplicates);
    }
  };

  return (
    <div className="bg-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="text-primary font-semibold">AI 추천</span>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        {/* Make files into 1 dataset */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
              isMerged
                ? 'bg-primary'
                : 'bg-background border-2 border-muted-foreground/30 group-hover:border-primary/50'
            }`}
            onClick={toggleMerge}
          >
            {isMerged && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
          </div>
          <span className={`text-sm transition-colors ${isMerged ? 'text-foreground' : 'text-muted-foreground'}`}>
            {fileCount}개의 파일을 하나의 데이터셋으로 통합 (총 {formatNumber(totalRows)}행)
          </span>
        </label>

        {/* Remove duplicated rows */}
        <label className={`flex items-center gap-3 group ${isMerged ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
              removeDuplicates && isMerged
                ? 'bg-primary'
                : 'bg-background border-2 border-muted-foreground/30 group-hover:border-primary/50'
            } ${!isMerged ? 'opacity-50' : ''}`}
            onClick={toggleRemoveDuplicates}
          >
            {removeDuplicates && isMerged && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
          </div>
          <span className={`text-sm transition-colors ${removeDuplicates && isMerged ? 'text-foreground' : 'text-muted-foreground'}`}>
            중복된 {formatNumber(duplicateRows)}행 제거 (총 예상 {formatNumber(estimatedRows)}행)
          </span>
        </label>
      </div>
    </div>
  );
}
