import mongoose from 'mongoose';
import type { PipelineStage } from 'mongoose';
import { getInjectedModel, getEntityClass } from '../decorators/Repository.js';
import { getRelationMetadata } from '../decorators/Relation.js';
import type { RelationMetadata } from '../decorators/Relation.js';
import { Pageable } from '../pageable/Pageable.js';
import { PageResult } from '../pageable/PageResult.js';
import type { BuiltQuery, SaveOptions, UpdateOptions, DeleteOptions } from '../types/index.js';

/**
 * Abstract base repository class providing standard CRUD operations,
 * soft delete, hard delete, and query builder integration.
 *
 * All standard query methods automatically filter out soft-deleted documents
 * (where `deletedAt` is not null). Use the `*WithDeleted` or `*OnlyDeleted`
 * variants to include or exclusively query soft-deleted documents.
 *
 * **Auto-populate:** If the entity class has `@Relation` decorators, all query
 * methods will automatically perform `$lookup` aggregation to populate those
 * fields — even without using `CustomBuilder`.
 *
 * @typeParam T - The entity type (Zod-inferred or interface)
 *
 * @example
 * ```typescript
 * @Repository(User)
 * class UserRepository extends BaseRepository<IUser> {
 *   async findByName(name: string): Promise<IUser[]> {
 *     const builder = new CustomBuilder<IUser>()
 *       .with(SearchCustom.of('firstName', CustomOperation.LIKE, name))
 *     return this.find(builder.build())
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<T> {
  /** The Mongoose model — accessible in subclasses for direct queries */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected model!: mongoose.Model<any>;

  /** Relation metadata from @Relation decorators on the entity class */
  private _relations: RelationMetadata[] = [];

  constructor() {
    // Retrieve the model injected by @Repository decorator
    const model = getInjectedModel(this.constructor);
    if (model) {
      this.model = model;
    }

    // Retrieve relation metadata from the entity class
    const entityClass = getEntityClass(this.constructor);
    if (entityClass) {
      this._relations = getRelationMetadata(entityClass);
    }
  }

  /**
   * Whether this repository has any auto-populate relations defined.
   */
  protected get hasRelations(): boolean {
    return this._relations.length > 0;
  }

  // ── Standard CRUD (auto-filters soft-deleted) ───────────────────

  /**
   * Finds documents matching the given query, excluding soft-deleted documents.
   * If `@Relation` fields are defined, related documents are auto-populated.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @returns Array of matching documents
   */
  async find(query?: BuiltQuery<T>): Promise<T[]> {
    if (query && query.pipeline.length > 0) {
      const pipeline = [
        ...this.injectSoftDeleteFilter(query.pipeline),
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    // No builder query — use aggregation if relations exist, otherwise simple find
    if (this.hasRelations) {
      const pipeline: PipelineStage[] = [
        { $match: { deletedAt: null } } as PipelineStage,
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    const results = await this.model.find({ deletedAt: null }).lean().exec();
    return results as T[];
  }

  /**
   * Finds a single document matching the given query, excluding soft-deleted documents.
   * If `@Relation` fields are defined, related documents are auto-populated.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @returns The matching document or null
   */
  async findOne(query?: BuiltQuery<T>): Promise<T | null> {
    if (query && query.pipeline.length > 0) {
      const pipeline: PipelineStage[] = [
        ...this.injectSoftDeleteFilter(query.pipeline),
        ...this.buildRelationLookupPipeline(),
        { $limit: 1 },
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return (results[0] as T) || null;
    }

    if (this.hasRelations) {
      const pipeline: PipelineStage[] = [
        { $match: { deletedAt: null } } as PipelineStage,
        ...this.buildRelationLookupPipeline(),
        { $limit: 1 },
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return (results[0] as T) || null;
    }

    const result = await this.model.findOne({ deletedAt: null }).lean().exec();
    return result as T | null;
  }

  /**
   * Finds a document by its ID, excluding soft-deleted documents.
   * If `@Relation` fields are defined, related documents are auto-populated.
   *
   * @param id - The document's `_id`
   * @returns The document or null if not found or soft-deleted
   */
  async findById(id: string): Promise<T | null> {
    if (this.hasRelations) {
      const pipeline: PipelineStage[] = [
        { $match: { _id: new mongoose.Types.ObjectId(id), deletedAt: null } } as PipelineStage,
        ...this.buildRelationLookupPipeline(),
        { $limit: 1 },
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return (results[0] as T) || null;
    }

    const result = await this.model.findOne({ _id: id, deletedAt: null }).lean().exec();
    return result as T | null;
  }

  /**
   * Finds all documents matching the query with optional pagination.
   * Excludes soft-deleted documents. Auto-populates relations.
   *
   * If `pageable` is omitted, returns all results wrapped in a PageResult
   * with `page: 1` and `totalPages: 1`.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @param pageable - Optional Pageable for pagination and sorting
   * @returns Paginated result
   */
  async findAll(query?: BuiltQuery<T>, pageable?: Pageable): Promise<PageResult<T>> {
    if (query && query.pipeline.length > 0) {
      return this.findAllWithPipeline(query.pipeline, pageable, false);
    }

    // No pipeline — build one with soft delete filter + relations
    if (this.hasRelations) {
      const basePipeline: PipelineStage[] = [];
      return this.findAllWithPipeline(basePipeline, pageable, false);
    }

    // No pipeline, no relations — use standard Mongoose query
    const filter = { deletedAt: null };

    if (!pageable) {
      const results = await this.model.find(filter).lean().exec();
      return PageResult.ofAll(results as T[]);
    }

    const [total, content] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model
        .find(filter)
        .sort(pageable.getSortObject() || {})
        .skip(pageable.getSkip())
        .limit(pageable.size)
        .lean()
        .exec(),
    ]);

    return PageResult.of(content as T[], pageable.page, pageable.size, total);
  }

  /**
   * Saves a new document.
   *
   * @param data - The document data to save
   * @param options - Optional save options (actorId, ttl, expireAt)
   * @returns The saved document
   */
  async save(data: Partial<T>, options?: SaveOptions): Promise<T> {
    const actorId = options?.actorId ?? null;

    const docData: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
      createdBy: actorId,
      updatedBy: actorId,
      deletedAt: null,
      deletedBy: null,
    };

    // Handle TTL options
    if (options?.expireAt) {
      docData.expireAt = options.expireAt;
    } else if (options?.ttl !== undefined && options.ttl > 0) {
      docData.expireAt = new Date(Date.now() + options.ttl * 1000);
    } else {
      docData.expireAt = null;
    }

    const doc = new this.model(docData);
    const saved = await doc.save();
    return saved.toObject() as T;
  }

  /**
   * Saves multiple documents at once.
   *
   * @param dataArray - Array of document data to save
   * @param options - Optional save options (actorId, ttl, expireAt)
   * @returns Array of saved documents
   */
  async saveAll(dataArray: Partial<T>[], options?: SaveOptions): Promise<T[]> {
    const actorId = options?.actorId ?? null;

    const docs = dataArray.map((data) => {
      const docData: Record<string, unknown> = {
        ...(data as Record<string, unknown>),
        createdBy: actorId,
        updatedBy: actorId,
        deletedAt: null,
        deletedBy: null,
      };

      if (options?.expireAt) {
        docData.expireAt = options.expireAt;
      } else if (options?.ttl !== undefined && options.ttl > 0) {
        docData.expireAt = new Date(Date.now() + options.ttl * 1000);
      } else {
        docData.expireAt = null;
      }

      return docData;
    });

    const saved = await this.model.insertMany(docs);
    return saved.map((doc: mongoose.Document) => doc.toObject()) as T[];
  }

  /**
   * Updates an existing document by ID. Only sets `updatedBy`.
   *
   * @param id - The document's `_id`
   * @param data - The fields to update
   * @param options - Optional update options (actorId)
   * @returns The updated document or null if not found
   */
  async update(id: string, data: Partial<T>, options?: UpdateOptions): Promise<T | null> {
    const actorId = options?.actorId ?? null;

    const updated = await this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          ...(data as Record<string, unknown>),
          updatedBy: actorId,
        },
      },
      { new: true, lean: true }
    ).exec();

    return updated as T | null;
  }

  // ── Soft Delete ─────────────────────────────────────────────────

  /**
   * Soft-deletes a document by setting `deletedAt` to the current date.
   * The document remains in the database but is excluded from standard queries.
   *
   * @param id - The document's `_id`
   * @param options - Optional delete options (actorId)
   * @returns `true` if the document was soft-deleted, `false` if not found
   */
  async softDelete(id: string, options?: DeleteOptions): Promise<boolean> {
    const actorId = options?.actorId ?? null;

    const result = await this.model.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: actorId,
          updatedBy: actorId,
        },
      },
      { new: true }
    ).exec();

    return result !== null;
  }

  /**
   * Restores a soft-deleted document by setting `deletedAt` back to null.
   *
   * @param id - The document's `_id`
   * @param options - Optional options (actorId)
   * @returns `true` if the document was restored, `false` if not found
   */
  async restore(id: string, options?: DeleteOptions): Promise<boolean> {
    const actorId = options?.actorId ?? null;

    const result = await this.model.findOneAndUpdate(
      { _id: id, deletedAt: { $ne: null } },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
          updatedBy: actorId,
        },
      },
      { new: true }
    ).exec();

    return result !== null;
  }

  // ── Hard Delete ─────────────────────────────────────────────────

  /**
   * Permanently deletes a document from the database.
   * This action is irreversible.
   *
   * @param id - The document's `_id`
   * @returns `true` if the document was deleted, `false` if not found
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Alias for `delete()` — permanently deletes a document.
   * Use this to make the intent explicit when distinguishing from soft delete.
   *
   * @param id - The document's `_id`
   * @returns `true` if the document was deleted, `false` if not found
   */
  async hardDelete(id: string): Promise<boolean> {
    return this.delete(id);
  }

  // ── Queries Including Deleted ───────────────────────────────────

  /**
   * Finds documents matching the query, INCLUDING soft-deleted documents.
   * Auto-populates relations.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @returns Array of matching documents (including soft-deleted)
   */
  async findWithDeleted(query?: BuiltQuery<T>): Promise<T[]> {
    if (query && query.pipeline.length > 0) {
      const pipeline = [
        ...query.pipeline,
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    if (this.hasRelations) {
      const pipeline: PipelineStage[] = [
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    const results = await this.model.find({}).lean().exec();
    return results as T[];
  }

  /**
   * Finds ONLY soft-deleted documents matching the query.
   * Auto-populates relations.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @returns Array of soft-deleted documents
   */
  async findOnlyDeleted(query?: BuiltQuery<T>): Promise<T[]> {
    if (query && query.pipeline.length > 0) {
      const pipeline = [
        ...this.injectDeletedOnlyFilter(query.pipeline),
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    if (this.hasRelations) {
      const pipeline: PipelineStage[] = [
        { $match: { deletedAt: { $ne: null } } } as PipelineStage,
        ...this.buildRelationLookupPipeline(),
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return results as T[];
    }

    const results = await this.model.find({ deletedAt: { $ne: null } }).lean().exec();
    return results as T[];
  }

  /**
   * Finds all documents with pagination, INCLUDING soft-deleted documents.
   * Auto-populates relations.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @param pageable - Optional Pageable for pagination and sorting
   * @returns Paginated result including soft-deleted documents
   */
  async findAllWithDeleted(query?: BuiltQuery<T>, pageable?: Pageable): Promise<PageResult<T>> {
    if (query && query.pipeline.length > 0) {
      return this.findAllWithPipeline(query.pipeline, pageable, true);
    }

    if (this.hasRelations) {
      const basePipeline: PipelineStage[] = [];
      return this.findAllWithPipeline(basePipeline, pageable, true);
    }

    const filter = {};

    if (!pageable) {
      const results = await this.model.find(filter).lean().exec();
      return PageResult.ofAll(results as T[]);
    }

    const [total, content] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model
        .find(filter)
        .sort(pageable.getSortObject() || {})
        .skip(pageable.getSkip())
        .limit(pageable.size)
        .lean()
        .exec(),
    ]);

    return PageResult.of(content as T[], pageable.page, pageable.size, total);
  }

  // ── Count ───────────────────────────────────────────────────────

  /**
   * Counts documents matching the query, excluding soft-deleted documents.
   *
   * @param query - Optional BuiltQuery from CustomBuilder.build()
   * @returns The count of matching documents
   */
  async count(query?: BuiltQuery<T>): Promise<number> {
    if (query && query.pipeline.length > 0) {
      const pipeline: PipelineStage[] = [
        ...this.injectSoftDeleteFilter(query.pipeline),
        { $count: 'total' },
      ];
      const results = await this.model.aggregate(pipeline).exec();
      return (results[0] as { total: number })?.total ?? 0;
    }

    return this.model.countDocuments({ deletedAt: null }).exec();
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Builds the `$lookup` + `$unwind` (for belongsTo) pipeline stages
   * for all `@Relation` decorators defined on the entity class.
   *
   * This enables auto-population of related documents on every query.
   */
  private buildRelationLookupPipeline(): PipelineStage[] {
    if (this._relations.length === 0) return [];

    const stages: PipelineStage[] = [];

    for (const rel of this._relations) {
      // $lookup stage
      stages.push({
        $lookup: {
          from: rel.collection,
          localField: rel.localField,
          foreignField: rel.foreignField,
          as: rel.propertyKey,
        },
      } as PipelineStage);

      // For belongsTo: $unwind to convert array to single object (or null)
      if (rel.type === 'belongsTo') {
        stages.push({
          $unwind: {
            path: `$${rel.propertyKey}`,
            preserveNullAndEmptyArrays: true, // null if no match
          },
        } as PipelineStage);
      }
    }

    return stages;
  }

  /**
   * Executes a paginated aggregation pipeline.
   */
  private async findAllWithPipeline(
    basePipeline: PipelineStage[],
    pageable: Pageable | undefined,
    includeDeleted: boolean
  ): Promise<PageResult<T>> {
    const pipeline = includeDeleted
      ? [...basePipeline]
      : this.injectSoftDeleteFilter(basePipeline);

    // Append relation lookups
    pipeline.push(...this.buildRelationLookupPipeline());

    if (!pageable) {
      const results = await this.model.aggregate(pipeline).exec();
      return PageResult.ofAll(results as T[]);
    }

    // Use $facet to get both data and count in a single query
    const dataPipeline: PipelineStage[] = [];

    if (pageable.getSortObject()) {
      dataPipeline.push({ $sort: pageable.getSortObject()! } as PipelineStage);
    }
    dataPipeline.push({ $skip: pageable.getSkip() } as PipelineStage);
    dataPipeline.push({ $limit: pageable.size } as PipelineStage);

    const facetPipeline: PipelineStage[] = [
      ...pipeline,
      {
        $facet: {
          data: dataPipeline,
          totalCount: [{ $count: 'count' }],
        },
      } as PipelineStage,
    ];

    const results = await this.model.aggregate(facetPipeline).exec();
    const facetResult = results[0] as { data: T[]; totalCount: { count: number }[] } | undefined;
    const data = facetResult?.data ?? [];
    const total = facetResult?.totalCount?.[0]?.count ?? 0;

    return PageResult.of(data, pageable.page, pageable.size, total);
  }

  /**
   * Injects a `{ deletedAt: null }` $match stage at the beginning of the pipeline
   * to filter out soft-deleted documents.
   */
  private injectSoftDeleteFilter(pipeline: PipelineStage[]): PipelineStage[] {
    return [
      { $match: { deletedAt: null } } as PipelineStage,
      ...pipeline,
    ];
  }

  /**
   * Injects a `{ deletedAt: { $ne: null } }` $match stage to select only
   * soft-deleted documents.
   */
  private injectDeletedOnlyFilter(pipeline: PipelineStage[]): PipelineStage[] {
    return [
      { $match: { deletedAt: { $ne: null } } } as PipelineStage,
      ...pipeline,
    ];
  }
}
