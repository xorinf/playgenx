/** A validation failure with an optional line number. */
export interface ValidationError {
  readonly message: string;
  readonly line?: number;
}

/** Options accepted by {@link validate}. */
export interface ValidateOptions {
  /**
   * Skip the JSX-tag balance check. Use for JSON-bodied artifacts
   * (poll, quiz, flashcards) where the body is parsed as data, not
   * rendered as TSX.
   */
  readonly skipJsxCheck?: boolean;
  /**
   * Skip the JSON-shape check for JSON-bodied artifacts. Use this only
   * if you've already validated the body yourself with a stricter schema.
   */
  readonly skipJsonCheck?: boolean;
}