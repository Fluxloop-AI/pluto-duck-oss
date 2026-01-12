'use client';

import { DatabaseIcon, FileTextIcon, FolderIcon, ServerIcon } from 'lucide-react';

interface ConnectorCardProps {
  type: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  onClick: () => void;
}

function ConnectorCard({ type, name, icon, description, onClick }: ConnectorCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center transition hover:border-primary/60 hover:bg-accent"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/20">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

interface ConnectorGridProps {
  onConnectorClick: (connectorType: string) => void;
}

const CONNECTORS = [
  {
    type: 'file',
    name: 'Import file',
    icon: <FileTextIcon className="h-8 w-8" />,
    description: 'Create a Dataset from one file (CSV/Parquet)',
  },
  {
    type: 'folder',
    name: 'Connect folder',
    icon: <FolderIcon className="h-8 w-8" />,
    description: 'Add a folder as a Source and import files from it',
  },
  {
    type: 'postgres',
    name: 'PostgreSQL',
    icon: <ServerIcon className="h-8 w-8" />,
    description: 'Connect to PostgreSQL database',
  },
  {
    type: 'sqlite',
    name: 'SQLite',
    icon: <DatabaseIcon className="h-8 w-8" />,
    description: 'Import from SQLite database',
  },
];

export function ConnectorGrid({ onConnectorClick }: ConnectorGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {CONNECTORS.map(connector => (
        <ConnectorCard
          key={connector.type}
          type={connector.type}
          name={connector.name}
          icon={connector.icon}
          description={connector.description}
          onClick={() => onConnectorClick(connector.type)}
        />
      ))}
    </div>
  );
}

