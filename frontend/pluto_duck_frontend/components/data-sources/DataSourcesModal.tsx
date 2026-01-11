'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { type DataSource } from '../../lib/dataSourcesApi';
import { ConnectorGrid } from './ConnectorGrid';

interface DataSourcesModalProps {
  projectId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportClick: (connectorType: string, source?: DataSource) => void;
  refreshTrigger?: number;
  onNavigateToAssets?: () => void;
}

export function DataSourcesModal({ 
  open, 
  onOpenChange, 
  onImportClick,
  onNavigateToAssets,
}: DataSourcesModalProps) {
  
  const handleConnectorClick = (connectorType: string) => {
    onImportClick(connectorType);
  };

  const handleConnectionSuccess = () => {
    onOpenChange(false);
    if (onNavigateToAssets) {
      onNavigateToAssets();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Data</DialogTitle>
          <DialogDescription>
            Import files or connect to external databases
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ConnectorGrid 
            onConnectorClick={handleConnectorClick}
                    />
                </div>

        <div className="border-t pt-4 text-center">
          <button
            onClick={() => {
              onOpenChange(false);
              if (onNavigateToAssets) {
                onNavigateToAssets();
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            View connected sources in Asset Library →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
