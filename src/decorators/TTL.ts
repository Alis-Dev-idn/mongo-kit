import 'reflect-metadata';
import { TTL_METADATA_KEY } from '../types/index.js';
import type { TTLMetadata } from '../types/index.js';

/**
 * `@TTL` decorator — defines a TTL (Time-To-Live) index on a schema class.
 *
 * MongoDB's background TTL thread will automatically delete documents when
 * the specified field's value + `expireAfterSeconds` has passed.
 *
 * Common patterns:
 * - `@TTL('expireAt', 0)` — document expires at the exact `expireAt` date
 * - `@TTL('createdAt', 86400)` — document expires 24 hours after creation
 * - `@TTL('lastAccess', 3600)` — document expires 1 hour after last access
 *
 * Note: `BaseEntity` already includes an `expireAt` field with a default TTL index
 * (expireAfterSeconds: 0). This decorator is for additional/custom TTL fields.
 *
 * @param field - The date field to create the TTL index on
 * @param expireAfterSeconds - Seconds after the field's date value to expire the document
 *
 * @example
 * ```typescript
 * // Documents expire 30 days after creation
 * @TTL('createdAt', 2592000)
 * @Schema({ collection: 'sessions' })
 * class Session extends BaseEntity {
 *   token: string;
 *   userId: string;
 * }
 *
 * // Documents expire at the exact sessionEnd date
 * @TTL('sessionEnd', 0)
 * @Schema({ collection: 'temp_data' })
 * class TempData extends BaseEntity {
 *   sessionEnd: Date;
 *   data: string;
 * }
 * ```
 */
export function TTL(field: string, expireAfterSeconds: number): ClassDecorator {
  return function (target: Function) {
    if (expireAfterSeconds < 0) {
      throw new Error(
        `[mongo-kit] @TTL error on class "${target.name}": expireAfterSeconds must be >= 0, got ${expireAfterSeconds}`
      );
    }

    // Get existing TTL configs or initialize empty array
    const existingTTL: TTLMetadata[] =
      Reflect.getMetadata(TTL_METADATA_KEY, target) || [];

    // Check for duplicate TTL on the same field
    const duplicate = existingTTL.find((t) => t.field === field);
    if (duplicate) {
      throw new Error(
        `[mongo-kit] @TTL error on class "${target.name}": duplicate TTL index on field "${field}"`
      );
    }

    // Add the new TTL definition
    existingTTL.push({ field, expireAfterSeconds });

    // Store updated TTL metadata on the class
    Reflect.defineMetadata(TTL_METADATA_KEY, existingTTL, target);
  };
}
