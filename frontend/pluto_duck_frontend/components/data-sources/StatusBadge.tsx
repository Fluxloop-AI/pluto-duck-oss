'use client';

import { Check, AlertCircle } from 'lucide-react';

export type DatasetStatus = 'ready' | 'review';

interface StatusBadgeProps {
  status: DatasetStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'ready') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
        <span className="text-green-600 font-medium text-sm">준비 완료</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <AlertCircle className="w-5 h-5 text-yellow-500" />
      <span className="text-yellow-600 font-medium text-sm">검토 필요</span>
    </div>
  );
}
