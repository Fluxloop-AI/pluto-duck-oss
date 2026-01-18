import { exportAnalysisCsv, getAnalysisDownloadUrl } from './assetsApi';
import { isTauriRuntime } from './tauriRuntime';

export interface DownloadAnalysisCsvOptions {
  projectId?: string;
  force?: boolean;
  suggestedName?: string;
}

export async function downloadAnalysisCsv(
  analysisId: string,
  options: DownloadAnalysisCsvOptions = {}
): Promise<void> {
  const suggestedName = options.suggestedName ?? analysisId;
  const force = options.force ?? false;

  if (isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const filePath = await save({
      defaultPath: `${suggestedName}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (!filePath || typeof filePath !== 'string') {
      return;
    }

    await exportAnalysisCsv(
      analysisId,
      {
        file_path: filePath,
        force,
      },
      options.projectId
    );
    return;
  }

  if (typeof window === 'undefined') {
    throw new Error('CSV download requires a browser environment');
  }

  const url = getAnalysisDownloadUrl(analysisId, {
    projectId: options.projectId,
    force,
  });

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to download analysis CSV');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${suggestedName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
