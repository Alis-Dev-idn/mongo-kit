import 'reflect-metadata';
import mongoose from 'mongoose';
import { SCHEMA_METADATA_KEY, VIRTUAL_METADATA_KEY, INDEX_METADATA_KEY, TTL_METADATA_KEY } from '../types/index.js';
import type { SchemaDecoratorOptions, VirtualFieldMetadata, IndexMetadata, TTLMetadata } from '../types/index.js';
import { BASE_ENTITY_SCHEMA_FIELDS } from '../base/BaseEntity.js';

/**
 * Schema registry — maps entity class constructor to its Mongoose Schema instance.
 * Used by @Repository to retrieve the schema when creating a Model.
 */
export const SchemaRegistry = new Map<Function, mongoose.Schema>();

/**
 * Collection name registry — maps entity class constructor to its collection name.
 * Used by query builder for $lookup resolution.
 */
export const CollectionRegistry = new Map<Function, string>();

/**
 * Reverse collection registry — maps collection name to entity class constructor.
 */
export const CollectionToClassRegistry = new Map<string, Function>();

/**
 * `@Schema` decorator — wraps a class as a Mongoose schema definition.
 *
 * Stores schema metadata via `reflect-metadata` and creates a Mongoose `Schema`
 * instance with BaseEntity fields, virtual fields, custom indexes, and TTL indexes.
 *
 * @param options - Mongoose SchemaOptions with a required `collection` name
 *
 * @example
 * ```typescript
 * @Schema({ collection: 'users', timestamps: true })
 * class User extends BaseEntity {
 *   firstName: string;
 *   lastName: string;
 * }
 * ```
 */
export function Schema(options: SchemaDecoratorOptions): ClassDecorator {
  return function (target: Function) {
    // Ensure timestamps is enabled by default
    const schemaOptions: SchemaDecoratorOptions = {
      timestamps: true,
      ...options,
      toJSON: {
        virtuals: true,
        ...(options.toJSON as Record<string, unknown> || {}),
      },
      toObject: {
        virtuals: true,
        ...(options.toObject as Record<string, unknown> || {}),
      },
    };

    // Store schema metadata on the class
    Reflect.defineMetadata(SCHEMA_METADATA_KEY, schemaOptions, target);

    // Create Mongoose schema with BaseEntity fields
    const mongooseSchema = new mongoose.Schema(
      {
        ...BASE_ENTITY_SCHEMA_FIELDS,
      },
      {
        ...schemaOptions,
        strict: false, // Allow fields not explicitly defined in schema (entity class fields)
      }
    );

    // Register virtual fields if any
    const virtuals: VirtualFieldMetadata[] =
      Reflect.getMetadata(VIRTUAL_METADATA_KEY, target.prototype) || [];

    for (const virtual of virtuals) {
      mongooseSchema.virtual(virtual.propertyKey).get(function (this: unknown) {
        return virtual.resolver(this);
      });
    }

    // Register custom indexes if any
    const indexes: IndexMetadata[] =
      Reflect.getMetadata(INDEX_METADATA_KEY, target) || [];

    for (const idx of indexes) {
      mongooseSchema.index(idx.fields, idx.options || {});
    }

    // Register TTL indexes if any
    const ttlConfigs: TTLMetadata[] =
      Reflect.getMetadata(TTL_METADATA_KEY, target) || [];

    for (const ttl of ttlConfigs) {
      mongooseSchema.index(
        { [ttl.field]: 1 } as Record<string, 1>,
        { expireAfterSeconds: ttl.expireAfterSeconds }
      );
    }

    // Always add a TTL index on `expireAt` for BaseEntity TTL support
    // Only add if not already explicitly configured via @TTL
    const hasExpireAtTTL = ttlConfigs.some((t) => t.field === 'expireAt');
    if (!hasExpireAtTTL) {
      mongooseSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0, sparse: true });
    }

    // Add index on deletedAt for soft delete filtering performance
    mongooseSchema.index({ deletedAt: 1 }, { sparse: true });

    // Store in registries
    SchemaRegistry.set(target, mongooseSchema);
    CollectionRegistry.set(target, options.collection);
    CollectionToClassRegistry.set(options.collection, target);
  };
}
