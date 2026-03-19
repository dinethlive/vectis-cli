export interface PenpotPage {
  id: string;
  name: string;
  shapes?: PenpotShape[];
}

export interface PenpotShape {
  id: string;
  name: string;
  type: string;
  children?: PenpotShape[];
  [key: string]: unknown;
}

export interface PenpotComponent {
  id: string;
  name: string;
  variants?: string[];
  annotation?: string;
}

export interface PenpotDesignTokens {
  [setName: string]: Record<string, unknown>;
}

export interface PenpotEvent {
  type: string;
  payload: Record<string, unknown>;
}
