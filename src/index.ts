/**
 * @workspace/mongo-kit
 *
 * Decorator-based MongoDB schema & repository library with fluent query builder,
 * soft delete, hard delete, TTL, custom indexes, and auto-populate relations.
 *
 * @module mongo-kit
 */

// ── Reflect Metadata (must be imported first) ─────────────────────
import 'reflect-metadata';

// ── Connection ────────────────────────────────────────────────────
export { MongoConnection } from './connection/MongoConnection.js';
export type { MongoConnectionOptions } from './connection/MongoConnection.js';

// ── Base ──────────────────────────────────────────────────────────
export { BaseEntity, BaseEntitySchema, BASE_ENTITY_SCHEMA_FIELDS } from './base/BaseEntity.js';
export type { IBaseEntity } from './base/BaseEntity.js';
export { BaseRepository } from './base/BaseRepository.js';

// ── Decorators ────────────────────────────────────────────────────
export { Schema, SchemaRegistry, CollectionRegistry, CollectionToClassRegistry } from './decorators/Schema.js';
export { VirtualField } from './decorators/VirtualField.js';
export { Repository, getInjectedModel, getEntityClass } from './decorators/Repository.js';
export { Index } from './decorators/Index.js';
export { TTL } from './decorators/TTL.js';
export { Relation, getRelationMetadata, RELATION_METADATA_KEY } from './decorators/Relation.js';
export type { RelationMetadata, RelationOptions, RelationType } from './decorators/Relation.js';

// ── Query Builder ─────────────────────────────────────────────────
export { CustomBuilder } from './builder/CustomBuilder.js';
export { SearchCustom } from './builder/SearchCustom.js';
export { MultipleSearch } from './builder/MultipleSearch.js';
export { CustomOperation, isJoinOperation, getBaseOperation } from './builder/CustomOperation.js';

// ── Pageable ──────────────────────────────────────────────────────
export { Pageable } from './pageable/Pageable.js';
export { PageResult } from './pageable/PageResult.js';

// ── Types ─────────────────────────────────────────────────────────
export type {
  SchemaDecoratorOptions,
  SchemaMetadata,
  FieldDefinition,
  VirtualResolver,
  VirtualFieldMetadata,
  IndexMetadata,
  TTLMetadata,
  BuiltQuery,
  SaveOptions,
  UpdateOptions,
  DeleteOptions,
  JoinPathInfo,
} from './types/index.js';

export {
  SCHEMA_METADATA_KEY,
  VIRTUAL_METADATA_KEY,
  INDEX_METADATA_KEY,
  TTL_METADATA_KEY,
} from './types/index.js';
