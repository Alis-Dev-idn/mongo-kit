import type { PipelineStage } from 'mongoose';
import { SearchCustom } from './SearchCustom.js';
import { MultipleSearch } from './MultipleSearch.js';
import { CustomOperation, isJoinOperation, getBaseOperation } from './CustomOperation.js';
import type { BuiltQuery } from '../types/index.js';

/**
 * Parsed information about a join field path.
 */
interface ParsedJoinPath {
  /** The local field that references the foreign collection (e.g., 'profileId' or 'profile') */
  localField: string;
  /** The foreign collection name (e.g., 'profiles') */
  foreignCollection: string;
  /** The alias used for the joined data (e.g., 'profile') */
  asField: string;
  /** The field to match inside the foreign collection (e.g., 'city') */
  foreignMatchField: string;
}

/**
 * Fluent query builder that accumulates conditions incrementally and resolves
 * them into a Mongoose aggregation pipeline via `.build()`.
 *
 * Conditions are added one by one using `.with()`, allowing dynamic filter
 * construction based on runtime input. `.build()` is called once after all
 * conditions are accumulated.
 *
 * **Pipeline resolution rules:**
 * - Simple field conditions → `$match` stage
 * - Join field conditions → `$lookup` + `$match` (auto-resolved from dot-notation path)
 * - Multiple AND conditions → combined with `$and` inside `$match`
 * - Multiple OR conditions → combined with `$or` inside `$match`
 * - Duplicate `$lookup` for the same foreign collection is merged into a single stage
 * - `build()` is pure — calling it multiple times produces the same result
 *
 * @example
 * ```typescript
 * const builder = new CustomBuilder<IUser>()
 *   .with(SearchCustom.of('firstName', CustomOperation.LIKE, 'Dudi'))
 *   .with(SearchCustom.of('user.profile.city', CustomOperation.OPERATION_JOIN_EQUAL, 'Jakarta'))
 *
 * const query = builder.build()
 * const users = await userRepo.find(query)
 * ```
 */
export class CustomBuilder<T = unknown> {
  private conditions: Array<SearchCustom | MultipleSearch> = [];

  /**
   * Adds a condition to the builder. Conditions accumulate and are resolved
   * when `.build()` is called.
   *
   * @param condition - A SearchCustom or MultipleSearch condition
   * @returns `this` for method chaining
   */
  with(condition: SearchCustom | MultipleSearch): this {
    this.conditions.push(condition);
    return this;
  }

  /**
   * Resolves all accumulated conditions into a Mongoose aggregation pipeline.
   *
   * This is a pure function with no side effects — calling it multiple times
   * produces the same deterministic result.
   *
   * @returns A BuiltQuery containing the aggregation pipeline stages
   */
  build(): BuiltQuery<T> {
    const pipeline: PipelineStage[] = [];
    const lookups = new Map<string, PipelineStage.Lookup['$lookup']>();
    const matchConditions: Record<string, unknown>[] = [];

    for (const condition of this.conditions) {
      if (condition instanceof SearchCustom) {
        this.processSearchCustom(condition, pipeline, lookups, matchConditions);
      } else if (condition instanceof MultipleSearch) {
        this.processMultipleSearch(condition, pipeline, lookups, matchConditions);
      }
    }

    // Add all lookups to the pipeline first
    for (const lookup of lookups.values()) {
      pipeline.push({ $lookup: lookup } as PipelineStage);
    }

    // Add the combined match stage
    if (matchConditions.length > 0) {
      if (matchConditions.length === 1) {
        pipeline.push({ $match: matchConditions[0] } as PipelineStage);
      } else {
        pipeline.push({ $match: { $and: matchConditions } } as PipelineStage);
      }
    }

    return { pipeline };
  }

  /**
   * Processes a single SearchCustom condition.
   */
  private processSearchCustom(
    condition: SearchCustom,
    _pipeline: PipelineStage[],
    lookups: Map<string, PipelineStage.Lookup['$lookup']>,
    matchConditions: Record<string, unknown>[]
  ): void {
    if (isJoinOperation(condition.operation)) {
      this.processJoinCondition(condition, lookups, matchConditions);
    } else {
      const matchExpr = this.buildMatchExpression(condition.field, condition.operation, condition.value);
      matchConditions.push(matchExpr);
    }
  }

  /**
   * Processes a MultipleSearch (AND/OR combined conditions).
   */
  private processMultipleSearch(
    multiSearch: MultipleSearch,
    _pipeline: PipelineStage[],
    lookups: Map<string, PipelineStage.Lookup['$lookup']>,
    matchConditions: Record<string, unknown>[]
  ): void {
    const subConditions: Record<string, unknown>[] = [];

    for (const condition of multiSearch.conditions) {
      if (isJoinOperation(condition.operation)) {
        this.processJoinCondition(condition, lookups, subConditions);
      } else {
        const matchExpr = this.buildMatchExpression(condition.field, condition.operation, condition.value);
        subConditions.push(matchExpr);
      }
    }

    if (subConditions.length > 0) {
      if (multiSearch.operator === SearchCustom.OPERATION_AND) {
        matchConditions.push({ $and: subConditions });
      } else {
        matchConditions.push({ $or: subConditions });
      }
    }
  }

  /**
   * Processes a join (relational) condition.
   * Parses the dot-notation field path, creates or merges $lookup,
   * and adds the match condition for the joined data.
   */
  private processJoinCondition(
    condition: SearchCustom,
    lookups: Map<string, PipelineStage.Lookup['$lookup']>,
    matchConditions: Record<string, unknown>[]
  ): void {
    const parsed = this.parseJoinPath(condition.field);
    const baseOp = getBaseOperation(condition.operation);

    // Create or merge $lookup
    if (!lookups.has(parsed.asField)) {
      lookups.set(parsed.asField, {
        from: parsed.foreignCollection,
        localField: parsed.localField,
        foreignField: '_id',
        as: parsed.asField,
      });
    }

    // Add match condition on the joined field
    // After $lookup, the joined data is an array — use $elemMatch or dot notation
    const matchField = `${parsed.asField}.${parsed.foreignMatchField}`;
    const matchExpr = this.buildMatchExpression(matchField, baseOp, condition.value);
    matchConditions.push(matchExpr);
  }

  /**
   * Parses a dot-notation field path for join operations.
   *
   * Format: `currentAlias.foreignCollection.foreignField`
   * - `currentAlias` = alias of the current entity (ignored — just for readability)
   * - `foreignCollection` = the foreign collection name (becomes the `from` and `as` in $lookup)
   * - `foreignField` = the field to match inside the foreign collection
   *
   * @example
   * ```
   * 'user.profile.city' → {
   *   localField: 'profile',
   *   foreignCollection: 'profiles',
   *   asField: 'profile',
   *   foreignMatchField: 'city'
   * }
   * ```
   */
  private parseJoinPath(fieldPath: string): ParsedJoinPath {
    const parts = fieldPath.split('.');

    if (parts.length < 3) {
      throw new Error(
        `[mongo-kit] CustomBuilder: invalid join field path "${fieldPath}". ` +
        `Expected format: "alias.foreignCollection.field" (e.g., "user.profile.city"). ` +
        `Got ${parts.length} parts, minimum 3 required.`
      );
    }

    // parts[0] = current alias (e.g., 'user') — used for readability
    // parts[1] = foreign collection reference (e.g., 'profile')
    // parts[2..n] = field path inside the foreign collection (e.g., 'city' or 'address.city')
    const _currentAlias = parts[0];
    const foreignRef = parts[1];
    const foreignFieldParts = parts.slice(2);

    // The foreign collection name is typically the plural of the reference
    // e.g., 'profile' → 'profiles'
    // However, we use the reference as-is for localField and attempt plural for collection
    const foreignCollection = foreignRef.endsWith('s') ? foreignRef : `${foreignRef}s`;

    return {
      localField: foreignRef,
      foreignCollection,
      asField: foreignRef,
      foreignMatchField: foreignFieldParts.join('.'),
    };
  }

  /**
   * Builds a MongoDB match expression from a field, operation, and value.
   */
  private buildMatchExpression(
    field: string,
    operation: CustomOperation,
    value: unknown
  ): Record<string, unknown> {
    switch (operation) {
      case CustomOperation.EQUAL:
        return { [field]: value };

      case CustomOperation.NOT_EQUAL:
        return { [field]: { $ne: value } };

      case CustomOperation.GT:
        return { [field]: { $gt: value } };

      case CustomOperation.GTE:
        return { [field]: { $gte: value } };

      case CustomOperation.LT:
        return { [field]: { $lt: value } };

      case CustomOperation.LTE:
        return { [field]: { $lte: value } };

      case CustomOperation.LIKE:
        return { [field]: { $regex: this.escapeRegex(String(value)), $options: 'i' } };

      case CustomOperation.STARTS_WITH:
        return { [field]: { $regex: `^${this.escapeRegex(String(value))}`, $options: 'i' } };

      case CustomOperation.ENDS_WITH:
        return { [field]: { $regex: `${this.escapeRegex(String(value))}$`, $options: 'i' } };

      case CustomOperation.IN:
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };

      case CustomOperation.NOT_IN:
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };

      case CustomOperation.IS_NULL:
        return { [field]: null };

      case CustomOperation.IS_NOT_NULL:
        return { [field]: { $ne: null } };

      case CustomOperation.EXISTS:
        return { [field]: { $exists: true } };

      case CustomOperation.NOT_EXISTS:
        return { [field]: { $exists: false } };

      default:
        throw new Error(
          `[mongo-kit] CustomBuilder: unsupported operation "${operation}" for field "${field}"`
        );
    }
  }

  /**
   * Escapes special regex characters in a string to prevent injection.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
