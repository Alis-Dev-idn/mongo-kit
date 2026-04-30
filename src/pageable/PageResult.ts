/**
 * Wrapper for paginated query results.
 *
 * @example
 * ```typescript
 * const result = await userRepo.findAll(query, Pageable.of(1, 10))
 * console.log(result.content)    // T[]
 * console.log(result.totalPages) // number
 * console.log(result.hasNext)    // boolean
 * ```
 */
export class PageResult<T> {
  /** Data for the current page */
  readonly content: T[];

  /** Current page number (1-based) */
  readonly page: number;

  /** Items per page */
  readonly size: number;

  /** Total number of matching documents */
  readonly total: number;

  /** Total number of pages: `Math.ceil(total / size)` */
  readonly totalPages: number;

  /** Whether there is a previous page: `page > 1` */
  readonly hasPrev: boolean;

  /** Whether there is a next page: `page < totalPages` */
  readonly hasNext: boolean;

  private constructor(content: T[], page: number, size: number, total: number) {
    this.content = content;
    this.page = page;
    this.size = size;
    this.total = total;
    this.totalPages = size > 0 ? Math.ceil(total / size) : 1;
    this.hasPrev = page > 1;
    this.hasNext = page < this.totalPages;
  }

  /**
   * Creates a new PageResult instance.
   *
   * @param content - Array of items for the current page
   * @param page - Current page number (1-based)
   * @param size - Items per page
   * @param total - Total number of matching documents
   * @returns A new PageResult instance
   */
  static of<T>(content: T[], page: number, size: number, total: number): PageResult<T> {
    return new PageResult(content, page, size, total);
  }

  /**
   * Creates a PageResult wrapping all items (no pagination).
   * Used when `findAll` is called without a Pageable parameter.
   *
   * @param content - All matching items
   * @returns A PageResult with `page: 1`, `totalPages: 1`
   */
  static ofAll<T>(content: T[]): PageResult<T> {
    return new PageResult(content, 1, content.length || 1, content.length);
  }

  /**
   * Converts this PageResult to a plain JSON-serializable object.
   */
  toJSON(): {
    content: T[];
    page: number;
    size: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  } {
    return {
      content: this.content,
      page: this.page,
      size: this.size,
      total: this.total,
      totalPages: this.totalPages,
      hasPrev: this.hasPrev,
      hasNext: this.hasNext,
    };
  }
}
