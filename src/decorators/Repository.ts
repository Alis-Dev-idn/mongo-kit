import 'reflect-metadata';
import mongoose from 'mongoose';
import { SCHEMA_METADATA_KEY } from '../types/index.js';
import { SchemaRegistry, CollectionRegistry } from './Schema.js';

/**
 * Model registry — maps entity class constructor to its Mongoose Model instance.
 * Used to prevent duplicate model registration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModelRegistry = new Map<Function, mongoose.Model<any>>();

/**
 * `@Repository` decorator — marks a class as a repository tied to a specific entity.
 *
 * Reads schema metadata from the entity class decorated with `@Schema`,
 * registers the Mongoose model, and injects it into `this.model` on the repository.
 *
 * The decorated class must extend `BaseRepository<T>`.
 *
 * @param entityClass - The entity class decorated with `@Schema`
 *
 * @example
 * ```typescript
 * @Repository(User)
 * class UserRepository extends BaseRepository<IUser> {
 *   // inherits: find, findOne, findById, findAll, save, update, delete, etc.
 *   // also has: this.model (direct Mongoose Model access)
 * }
 * ```
 */
export function Repository(entityClass: Function): ClassDecorator {
  return function (target: Function) {
    // Validate that the entity class has @Schema metadata
    const schemaOptions = Reflect.getMetadata(SCHEMA_METADATA_KEY, entityClass);
    if (!schemaOptions) {
      throw new Error(
        `[mongo-kit] @Repository error on "${target.name}": ` +
        `Entity class "${entityClass.name}" is not decorated with @Schema. ` +
        `Ensure the entity class has the @Schema decorator applied.`
      );
    }

    // Retrieve the Mongoose schema from the registry
    const mongooseSchema = SchemaRegistry.get(entityClass);
    if (!mongooseSchema) {
      throw new Error(
        `[mongo-kit] @Repository error on "${target.name}": ` +
        `No Mongoose schema found for entity "${entityClass.name}". ` +
        `This is an internal error — the @Schema decorator should have registered it.`
      );
    }

    // Get the collection name
    const collectionName = CollectionRegistry.get(entityClass);
    if (!collectionName) {
      throw new Error(
        `[mongo-kit] @Repository error on "${target.name}": ` +
        `No collection name found for entity "${entityClass.name}".`
      );
    }

    // Get or create the Mongoose model (avoid duplicate model registration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: mongoose.Model<any>;
    const cachedModel = ModelRegistry.get(entityClass);

    if (cachedModel) {
      model = cachedModel;
    } else {
      // Check if model already exists in Mongoose (e.g., hot module reloading)
      try {
        model = mongoose.model(entityClass.name);
      } catch {
        model = mongoose.model(entityClass.name, mongooseSchema, collectionName);
      }
      ModelRegistry.set(entityClass, model);
    }

    // Store model metadata on the target class for BaseRepository to pick up
    Reflect.defineMetadata('mongo-kit:injected-model', model, target);

    // Store entity class reference for relation metadata lookup
    Reflect.defineMetadata('mongo-kit:entity-class', entityClass, target);
  };
}

/**
 * Retrieves the injected Mongoose model for a repository class.
 * Used internally by BaseRepository to access the model.
 *
 * @param target - The repository class (or its instance's constructor)
 * @returns The Mongoose Model instance, or undefined if not found
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getInjectedModel(target: Function): mongoose.Model<any> | undefined {
  return Reflect.getMetadata('mongo-kit:injected-model', target);
}

/**
 * Retrieves the entity class associated with a repository class.
 * Used internally by BaseRepository to access relation metadata.
 *
 * @param target - The repository class (or its instance's constructor)
 * @returns The entity class constructor, or undefined if not found
 */
export function getEntityClass(target: Function): Function | undefined {
  return Reflect.getMetadata('mongo-kit:entity-class', target);
}
