import 'reflect-metadata';
import type { IndexDefinition, IndexOptions } from 'mongoose';
import { INDEX_METADATA_KEY } from '../types/index.js';
import type { IndexMetadata } from '../types/index.js';

/**
 * `@Index` decorator — defines a custom index on a schema class.
 *
 * Supports single-field, compound, text, unique, sparse, and geospatial indexes.
 * The index is registered on the underlying Mongoose schema when `@Schema` processes
 * the class metadata.
 *
 * @param fields - Index field specification (e.g., `{ email: 1 }`, `{ name: 'text' }`)
 * @param options - Mongoose IndexOptions (e.g., `{ unique: true }`, `{ sparse: true }`)
 *
 * @example
 * ```typescript
 * // Unique index
 * @Index({ email: 1 }, { unique: true })
 *
 * // Compound index
 * @Index({ category: 1, price: -1 })
 *
 * // Text search index
 * @Index({ firstName: 'text', lastName: 'text' })
 *
 * // Geospatial index
 * @Index({ location: '2dsphere' })
 *
 * @Schema({ collection: 'users' })
 * class User extends BaseEntity { ... }
 * ```
 */
export function Index(fields: IndexDefinition, options?: IndexOptions): ClassDecorator {
  return function (target: Function) {
    // Get existing indexes or initialize empty array
    const existingIndexes: IndexMetadata[] =
      Reflect.getMetadata(INDEX_METADATA_KEY, target) || [];

    // Add the new index definition
    existingIndexes.push({ fields, options });

    // Store updated indexes metadata on the class
    Reflect.defineMetadata(INDEX_METADATA_KEY, existingIndexes, target);
  };
}
