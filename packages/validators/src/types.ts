/** A validation failure with an optional line number. */
export interface ValidationError {
  readonly message: string;
  readonly line?: number;
}
