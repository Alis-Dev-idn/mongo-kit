import 'reflect-metadata';
import { VIRTUAL_METADATA_KEY } from '../types/index.js';
import type { VirtualResolver, VirtualFieldMetadata } from '../types/index.js';

/**
 * `@VirtualField` decorator — defines a computed/virtual field on a schema class.
 *
 * The virtual is registered on the underlying Mongoose schema and included
 * in `.toJSON()` and `.toObject()` output by default.
 *
 * @param resolver - Function that computes the virtual field value from the document
 *
 * @example
 * ```typescript
 * @Schema({ collection: 'users' })
 * class User extends BaseEntity {
 *   @VirtualField((doc) => `${doc.firstName} ${doc.lastName}`)
 *   fullName: string;
 *
 *   firstName: string;
 *   lastName: string;
 * }
 * ```
 */
export function VirtualField<T = unknown>(resolver: VirtualResolver<T>): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    // Get existing virtuals or initialize empty array
    const existingVirtuals: VirtualFieldMetadata[] =
      Reflect.getMetadata(VIRTUAL_METADATA_KEY, target) || [];

    // Add the new virtual field definition
    existingVirtuals.push({
      propertyKey: String(propertyKey),
      resolver: resolver as VirtualResolver,
    });

    // Store updated virtuals metadata on the prototype
    Reflect.defineMetadata(VIRTUAL_METADATA_KEY, existingVirtuals, target);
  };
}
