/**
 * Enum of all supported query operations in the CustomBuilder.
 *
 * Operations are divided into categories:
 * - **Equality**: exact match / not equal
 * - **Comparison**: greater than, less than, etc.
 * - **String**: regex-based pattern matching
 * - **Array**: in / not in
 * - **Null check**: is null / is not null
 * - **Existence**: field exists / does not exist
 * - **Relational (Join)**: operations that trigger a `$lookup` into another collection
 */
export enum CustomOperation {
  // ── Equality ──────────────────────────────────────────────────

  /** Exact equality match: `{ field: value }` */
  EQUAL = 'equal',

  /** Not equal: `{ field: { $ne: value } }` */
  NOT_EQUAL = 'not_equal',

  // ── Comparison ────────────────────────────────────────────────

  /** Greater than: `{ field: { $gt: value } }` */
  GT = 'gt',

  /** Greater than or equal: `{ field: { $gte: value } }` */
  GTE = 'gte',

  /** Less than: `{ field: { $lt: value } }` */
  LT = 'lt',

  /** Less than or equal: `{ field: { $lte: value } }` */
  LTE = 'lte',

  // ── String ────────────────────────────────────────────────────

  /** Case-insensitive contains: `{ field: { $regex: value, $options: 'i' } }` */
  LIKE = 'like',

  /** Starts with: `{ field: { $regex: '^value', $options: 'i' } }` */
  STARTS_WITH = 'starts_with',

  /** Ends with: `{ field: { $regex: 'value$', $options: 'i' } }` */
  ENDS_WITH = 'ends_with',

  // ── Array ─────────────────────────────────────────────────────

  /** In array: `{ field: { $in: [values] } }` */
  IN = 'in',

  /** Not in array: `{ field: { $nin: [values] } }` */
  NOT_IN = 'not_in',

  // ── Null / Existence ──────────────────────────────────────────

  /** Field is null: `{ field: null }` */
  IS_NULL = 'is_null',

  /** Field is not null: `{ field: { $ne: null } }` */
  IS_NOT_NULL = 'is_not_null',

  /** Field exists: `{ field: { $exists: true } }` */
  EXISTS = 'exists',

  /** Field does not exist: `{ field: { $exists: false } }` */
  NOT_EXISTS = 'not_exists',

  // ── Relational (Join) ─────────────────────────────────────────
  // Prefixed with OPERATION_JOIN_ — triggers $lookup into another collection

  /** Join + exact equality */
  OPERATION_JOIN_EQUAL = 'join_equal',

  /** Join + case-insensitive contains */
  OPERATION_JOIN_LIKE = 'join_like',

  /** Join + in array */
  OPERATION_JOIN_IN = 'join_in',

  /** Join + greater than */
  OPERATION_JOIN_GT = 'join_gt',

  /** Join + greater than or equal */
  OPERATION_JOIN_GTE = 'join_gte',

  /** Join + less than */
  OPERATION_JOIN_LT = 'join_lt',

  /** Join + less than or equal */
  OPERATION_JOIN_LTE = 'join_lte',

  /** Join + starts with */
  OPERATION_JOIN_STARTS_WITH = 'join_starts_with',

  /** Join + ends with */
  OPERATION_JOIN_ENDS_WITH = 'join_ends_with',

  /** Join + not equal */
  OPERATION_JOIN_NOT_EQUAL = 'join_not_equal',
}

/**
 * Checks if an operation is a join (relational) operation.
 * Join operations require a `$lookup` stage in the aggregation pipeline.
 */
export function isJoinOperation(operation: CustomOperation): boolean {
  return operation.startsWith('join_');
}

/**
 * Maps a join operation to its corresponding simple operation.
 * Used internally to determine the `$match` operation inside the `$lookup` pipeline.
 */
export function getBaseOperation(operation: CustomOperation): CustomOperation {
  switch (operation) {
    case CustomOperation.OPERATION_JOIN_EQUAL:
      return CustomOperation.EQUAL;
    case CustomOperation.OPERATION_JOIN_LIKE:
      return CustomOperation.LIKE;
    case CustomOperation.OPERATION_JOIN_IN:
      return CustomOperation.IN;
    case CustomOperation.OPERATION_JOIN_GT:
      return CustomOperation.GT;
    case CustomOperation.OPERATION_JOIN_GTE:
      return CustomOperation.GTE;
    case CustomOperation.OPERATION_JOIN_LT:
      return CustomOperation.LT;
    case CustomOperation.OPERATION_JOIN_LTE:
      return CustomOperation.LTE;
    case CustomOperation.OPERATION_JOIN_STARTS_WITH:
      return CustomOperation.STARTS_WITH;
    case CustomOperation.OPERATION_JOIN_ENDS_WITH:
      return CustomOperation.ENDS_WITH;
    case CustomOperation.OPERATION_JOIN_NOT_EQUAL:
      return CustomOperation.NOT_EQUAL;
    default:
      return operation;
  }
}
