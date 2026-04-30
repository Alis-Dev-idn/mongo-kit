import { z } from 'zod';

/**
 * Abstract base entity class that all MongoDB entities must extend.
 *
 * Provides standard audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`),
 * soft delete support (`deletedAt`, `deletedBy`), and TTL support (`expireAt`).
 *
 * - `createdAt` and `updatedAt` are managed by Mongoose timestamps.
 * - `createdBy` and `updatedBy` are manually set via `actorId` option.
 * - `deletedAt` is set when soft-deleting; `null` means not deleted.
 * - `expireAt` is set for TTL-based auto-expiration by MongoDB.
 */
export abstract class BaseEntity {
  /** MongoDB document ID */
  _id!: string;

  /** Timestamp when the document was created (managed by Mongoose) */
  createdAt!: Date;

  /** Timestamp when the document was last updated (managed by Mongoose) */
  updatedAt!: Date;

  /** ID of the user who created this document, null if system */
  createdBy!: string | null;

  /** ID of the user who last updated this document, null if system */
  updatedBy!: string | null;

  /** Timestamp when the document was soft-deleted, null if not deleted */
  deletedAt!: Date | null;

  /** ID of the user who soft-deleted this document, null if not soft-deleted or system */
  deletedBy!: string | null;

  /** TTL expiry date — MongoDB will auto-remove the document at this time */
  expireAt!: Date | null;
}

/**
 * Mongoose schema definition for BaseEntity fields.
 * Used internally to inject base fields into every entity's Mongoose schema.
 */
export const BASE_ENTITY_SCHEMA_FIELDS = {
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  expireAt: { type: Date, default: null },
} as const;

/**
 * Zod schema for BaseEntity fields.
 * Consumer apps should extend this for their entity Zod schemas.
 *
 * @example
 * ```typescript
 * const IUserSchema = BaseEntitySchema.extend({
 *   firstName: z.string(),
 *   lastName: z.string(),
 * });
 * type IUser = z.infer<typeof IUserSchema>;
 * ```
 */
export const BaseEntitySchema = z.object({
  _id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.date().nullable(),
  deletedBy: z.string().nullable(),
  expireAt: z.date().nullable(),
});

/** Type inferred from BaseEntitySchema */
export type IBaseEntity = z.infer<typeof BaseEntitySchema>;
