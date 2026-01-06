export type ToolUIState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolUIType = `tool-${string}`;

export type ToolUIApproval =
  | {
      approved?: boolean;
      reason?: string;
    }
  | undefined;

export type ToolUIInput = unknown;

export type ToolUIOutput = unknown;


