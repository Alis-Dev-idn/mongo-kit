import 'reflect-metadata';

/** Metadata key for storing relation definitions on entity classes */
export const RELATION_METADATA_KEY = Symbol('mongo-kit:relation');

/**
 * Defines the type of relation between entities.
 */
export type RelationType = 'belongsTo' | 'hasMany';

/**
 * Stored metadata for a relation field.
 */
export interface RelationMetadata {
  /** The property name on the entity class */
  propertyKey: string;
  /** The collection name to join from */
  collection: string;
  /** The local field that stores the foreign key (e.g., 'profileId') */
  localField: string;
  /** The foreign field to match (usually '_id') */
  foreignField: string;
  /** The type of relation */
  type: RelationType;
}

/**
 * Options for the @Relation decorator.
 */
export interface RelationOptions {
  /** The foreign collection name to join (e.g., 'profiles') */
  collection: string;
  /**
   * The local field that stores the reference.
   * If omitted, defaults to the property name (e.g., property `profile` → localField `profile`).
   */
  localField?: string;
  /**
   * The foreign field to match against the local field value.
   * Defaults to `'_id'`.
   */
  foreignField?: string;
  /**
   * The type of relation:
   * - `'belongsTo'` — many-to-one (result is a single object or null)
   * - `'hasMany'` — one-to-many (result is an array)
   *
   * Defaults to `'belongsTo'`.
   */
  type?: RelationType;
}

/**
 * `@Relation` decorator — defines a relationship to another collection.
 *
 * When applied to a property, the BaseRepository will automatically perform
 * a `$lookup` aggregation to populate this field on all query results.
 *
 * For `belongsTo` relations, the joined array is unwound into a single object
 * (or null if no match). For `hasMany`, the result stays as an array.
 *
 * @param options - Relation configuration
 *
 * @example
 * ```typescript
 * @Schema({ collection: 'users', timestamps: true })
 * class User extends BaseEntity {
 *   firstName: string;
 *   lastName: string;
 *
 *   // belongsTo: auto-populates profile from 'profiles' collection
 *   @Relation({ collection: 'profiles', localField: 'profileId' })
 *   profile: IProfile | null;
 *
 *   // hasMany: auto-populates orders from 'orders' collection
 *   @Relation({ collection: 'orders', localField: '_id', foreignField: 'userId', type: 'hasMany' })
 *   orders: IOrder[];
 * }
 * ```
 */
export function Relation(options: RelationOptions): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const key = String(propertyKey);

    // Get existing relations or initialize empty array
    const existingRelations: RelationMetadata[] =
      Reflect.getMetadata(RELATION_METADATA_KEY, target) || [];

    // Add the new relation
    existingRelations.push({
      propertyKey: key,
      collection: options.collection,
      localField: options.localField ?? key,
      foreignField: options.foreignField ?? '_id',
      type: options.type ?? 'belongsTo',
    });

    // Store updated relations metadata on the prototype
    Reflect.defineMetadata(RELATION_METADATA_KEY, existingRelations, target);
  };
}

/**
 * Retrieves relation metadata from an entity class.
 *
 * @param entityClass - The entity class (constructor function)
 * @returns Array of RelationMetadata, or empty array if none
 */
export function getRelationMetadata(entityClass: Function): RelationMetadata[] {
  return Reflect.getMetadata(RELATION_METADATA_KEY, entityClass.prototype) || [];
}
