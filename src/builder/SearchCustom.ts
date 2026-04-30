import { CustomOperation } from './CustomOperation.js';

/**
 * Represents a single search condition in the query builder.
 *
 * Use the static `of()` factory method to create instances.
 * Conditions can be combined using `MultipleSearch` for AND/OR logic.
 *
 * @example
 * ```typescript
 * // Simple field match
 * SearchCustom.of('firstName', CustomOperation.LIKE, 'Dudi')
 *
 * // Join field match (triggers $lookup)
 * SearchCustom.of('user.profile.city', CustomOperation.OPERATION_JOIN_EQUAL, 'Jakarta')
 *
 * // Null check
 * SearchCustom.of('deletedAt', CustomOperation.IS_NULL, null)
 * ```
 */
export class SearchCustom {
  /** Logical AND operator for combining conditions */
  static readonly OPERATION_AND = 'AND' as const;

  /** Logical OR operator for combining conditions */
  static readonly OPERATION_OR = 'OR' as const;

  /** The field path to match on */
  readonly field: string;

  /** The operation to perform */
  readonly operation: CustomOperation;

  /** The value to match against */
  readonly value: unknown;

  private constructor(field: string, operation: CustomOperation, value: unknown) {
    this.field = field;
    this.operation = operation;
    this.value = value;
  }

  /**
   * Creates a new SearchCustom condition.
   *
   * @param field - Field path (e.g., `'firstName'`, `'user.profile.city'`)
   * @param operation - The comparison operation to apply
   * @param value - The value to compare against
   * @returns A new SearchCustom instance
   *
   * @throws Error if field is empty or invalid
   */
  static of(field: string, operation: CustomOperation, value: unknown): SearchCustom {
    if (!field || field.trim().length === 0) {
      throw new Error('[mongo-kit] SearchCustom.of: field must not be empty');
    }

    return new SearchCustom(field.trim(), operation, value);
  }
}
