import type { SchemaOptions, IndexDefinition, IndexOptions, PipelineStage } from 'mongoose';

// ── Metadata Keys ─────────────────────────────────────────────────

/** Metadata key for storing mongoose schema options on entity classes */
export const SCHEMA_METADATA_KEY = Symbol('mongo-kit:schema');

/** Metadata key for storing virtual field definitions on entity classes */
export const VIRTUAL_METADATA_KEY = Symbol('mongo-kit:virtual');

/** Metadata key for storing index definitions on entity classes */
export const INDEX_METADATA_KEY = Symbol('mongo-kit:index');

/** Metadata key for storing TTL index definitions on entity classes */
export const TTL_METADATA_KEY = Symbol('mongo-kit:ttl');

// ── Schema Types ──────────────────────────────────────────────────

/** Options for the @Schema decorator */
export interface SchemaDecoratorOptions extends SchemaOptions {
  collection: string;
}

/** Stored metadata for a schema-decorated class */
export interface SchemaMetadata {
  options: SchemaDecoratorOptions;
  fields: Record<string, FieldDefinition>;
}

/** Definition of a single field in the schema */
export interface FieldDefinition {
  type: unknown;
  required?: boolean;
  default?: unknown;
  index?: boolean;
  unique?: boolean;
  ref?: string;
}

// ── Virtual Field Types ───────────────────────────────────────────

/** Virtual field resolver function */
export type VirtualResolver<T = unknown> = (doc: T) => unknown;

/** Stored metadata for a virtual field */
export interface VirtualFieldMetadata {
  propertyKey: string;
  resolver: VirtualResolver;
}

// ── Index Types ───────────────────────────────────────────────────

/** Stored metadata for a custom index */
export interface IndexMetadata {
  fields: IndexDefinition;
  options?: IndexOptions;
}

// ── TTL Types ─────────────────────────────────────────────────────

/** Stored metadata for a TTL index */
export interface TTLMetadata {
  field: string;
  expireAfterSeconds: number;
}

// ── Query Builder Types ───────────────────────────────────────────

/** The resolved output of CustomBuilder.build() */
export interface BuiltQuery<T = unknown> {
  pipeline: PipelineStage[];
}

/** Options for saving an entity */
export interface SaveOptions {
  /** ID of the actor performing the operation */
  actorId?: string;
  /** Time-to-live in seconds from now — sets expireAt automatically */
  ttl?: number;
  /** Exact expiry date — sets expireAt directly */
  expireAt?: Date;
}

/** Options for updating an entity */
export interface UpdateOptions {
  /** ID of the actor performing the operation */
  actorId?: string;
}

/** Options for delete operations */
export interface DeleteOptions {
  /** ID of the actor performing the soft delete */
  actorId?: string;
}

// ── Lookup Resolution Types ───────────────────────────────────────

/** Parsed join path info for $lookup resolution */
export interface JoinPathInfo {
  /** The alias of the current collection in the dot path */
  currentAlias: string;
  /** The foreign collection name to $lookup */
  foreignCollection: string;
  /** The local field that references the foreign collection */
  localField: string;
  /** The field to match inside the foreign collection */
  foreignField: string;
}
