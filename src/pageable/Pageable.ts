/**
 * Input class representing pagination and sorting parameters.
 *
 * @example
 * ```typescript
 * const pageable = Pageable.of(1, 10, 'createdAt', 'desc')
 * const result = await userRepo.findAll(builder.build(), pageable)
 * ```
 */
export class Pageable {
  /** 1-based page number */
  readonly page: number;

  /** Number of items per page */
  readonly size: number;

  /** Field name to sort by */
  readonly sort?: string;

  /** Sort direction: ascending or descending */
  readonly order?: 'asc' | 'desc';

  private constructor(page: number, size: number, sort?: string, order?: 'asc' | 'desc') {
    this.page = Math.max(1, Math.floor(page));
    this.size = Math.max(1, Math.floor(size));
    this.sort = sort;
    this.order = order;
  }

  /**
   * Creates a new Pageable instance.
   *
   * @param page - 1-based page number (minimum 1)
   * @param size - Number of items per page (minimum 1)
   * @param sort - Optional field name to sort by
   * @param order - Optional sort direction ('asc' or 'desc')
   * @returns A new Pageable instance
   *
   * @example
   * ```typescript
   * // Page 1, 10 items, sorted by createdAt descending
   * Pageable.of(1, 10, 'createdAt', 'desc')
   *
   * // Page 2, 20 items, no sorting
   * Pageable.of(2, 20)
   * ```
   */
  static of(page: number, size: number, sort?: string, order?: 'asc' | 'desc'): Pageable {
    return new Pageable(page, size, sort, order);
  }

  /**
   * Calculates the number of documents to skip for MongoDB queries.
   * @returns The skip value: `(page - 1) * size`
   */
  getSkip(): number {
    return (this.page - 1) * this.size;
  }

  /**
   * Returns the MongoDB sort object.
   * @returns Sort specification or undefined if no sort field is set
   */
  getSortObject(): Record<string, 1 | -1> | undefined {
    if (!this.sort) return undefined;
    return { [this.sort]: this.order === 'desc' ? -1 : 1 };
  }
}
