import { SearchCustom } from './SearchCustom.js';

/**
 * Combines multiple `SearchCustom` conditions with a logical operator (AND / OR).
 *
 * @example
 * ```typescript
 * // AND: both conditions must match
 * MultipleSearch.of(
 *   SearchCustom.OPERATION_AND,
 *   SearchCustom.of('age', CustomOperation.GTE, 18),
 *   SearchCustom.of('age', CustomOperation.LTE, 65)
 * )
 *
 * // OR: at least one condition must match
 * MultipleSearch.of(
 *   SearchCustom.OPERATION_OR,
 *   SearchCustom.of('status', CustomOperation.EQUAL, 'active'),
 *   SearchCustom.of('status', CustomOperation.EQUAL, 'pending')
 * )
 * ```
 */
export class MultipleSearch {
  /** The logical operator ('AND' or 'OR') */
  readonly operator: typeof SearchCustom.OPERATION_AND | typeof SearchCustom.OPERATION_OR;

  /** The conditions to combine */
  readonly conditions: SearchCustom[];

  private constructor(
    operator: typeof SearchCustom.OPERATION_AND | typeof SearchCustom.OPERATION_OR,
    conditions: SearchCustom[]
  ) {
    this.operator = operator;
    this.conditions = conditions;
  }

  /**
   * Creates a new MultipleSearch combining multiple conditions.
   *
   * @param operator - Logical operator: `SearchCustom.OPERATION_AND` or `SearchCustom.OPERATION_OR`
   * @param conditions - One or more SearchCustom conditions
   * @returns A new MultipleSearch instance
   *
   * @throws Error if no conditions are provided
   */
  static of(
    operator: typeof SearchCustom.OPERATION_AND | typeof SearchCustom.OPERATION_OR,
    ...conditions: SearchCustom[]
  ): MultipleSearch {
    if (conditions.length === 0) {
      throw new Error('[mongo-kit] MultipleSearch.of: at least one condition is required');
    }

    return new MultipleSearch(operator, conditions);
  }
}
