# Prompt: Build `mongo-kit` — MongoDB Decorator & Query Builder Library (Node.js + TypeScript)

## Overview

Build a standalone TypeScript library called **`mongo-kit`** that provides:
1. Decorator-based schema and repository definitions for MongoDB (via Mongoose)
2. A fluent query builder with relational lookup support
3. Zod-based schema validation with nullable relation fields
4. Pageable support for paginated queries
5. Base entity with audit fields

This library will live in its own repository and be published as an npm package (e.g. `@workspace/mongo-kit`), intended to be consumed by separate application projects.

---

## Project Structure

```
mongo-kit/
├── src/
│   ├── decorators/
│   │   ├── Repository.ts        # @Repository decorator
│   │   ├── VirtualField.ts      # @VirtualField decorator
│   │   └── Schema.ts            # @Schema decorator (mongoose schema wrapper)
│   ├── builder/
│   │   ├── CustomBuilder.ts     # Main query builder class
│   │   ├── SearchCustom.ts      # Single condition builder
│   │   ├── MultipleSearch.ts    # Combined AND/OR condition builder
│   │   └── CustomOperation.ts  # Enum of supported operations
│   ├── base/
│   │   ├── BaseRepository.ts   # Abstract base repository class
│   │   └── BaseEntity.ts       # Base entity with audit fields
│   ├── pageable/
│   │   ├── Pageable.ts          # Pageable input class
│   │   └── PageResult.ts        # Paginated result wrapper
│   ├── types/
│   │   └── index.ts             # Shared internal types
│   └── index.ts                 # Public exports
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

```json
{
  "dependencies": {
    "mongoose": "^8.x",
    "zod": "^3.x",
    "reflect-metadata": "^0.2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x"
  }
}
```

Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

---

## 1. `BaseEntity`

All entity classes must extend `BaseEntity`. It provides standard audit fields that are automatically managed.

```typescript
abstract class BaseEntity {
  _id: string
  createdAt: Date
  updatedAt: Date
  createdBy: string | null   // _id of the actor, null if system
  updatedBy: string | null   // _id of the actor, null if system
}
```

**Requirements:**
- `createdAt` and `updatedAt` are managed automatically by Mongoose (`timestamps: true`)
- `createdBy` and `updatedBy` are **manually provided** by the caller via an `actorId` option on `save()` and `update()`
- If `actorId` is not provided (system operation, seeder, cron, etc.), both fields default to `null`
- `createdBy` and `updatedBy` store only the user `_id` as string — resolution to full user object is done separately via the query builder's lookup
- The corresponding Zod base schema exported by the library:

```typescript
const BaseEntitySchema = z.object({
  _id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
})
```

---

## 2. `@Schema` Decorator

Wraps a class as a Mongoose schema definition. Stores schema metadata for use by `@Repository`.

```typescript
@Schema({ collection: "users", timestamps: true })
class User extends BaseEntity {
  firstName: string
  lastName: string
}
```

**Requirements:**
- Accept Mongoose `SchemaOptions` as argument (collection name, timestamps, etc.)
- Use `reflect-metadata` to store schema definition on the class
- Internally create and register a Mongoose `Schema` instance
- Automatically include `BaseEntity` fields in the schema definition

---

## 3. `@VirtualField` Decorator

Defines a computed/virtual field on a schema class. The virtual is registered on the Mongoose schema.

```typescript
@Schema({ collection: "users" })
class User extends BaseEntity {
  @VirtualField((doc) => `${doc.firstName} ${doc.lastName}`)
  fullName: string

  firstName: string
  lastName: string
}
```

**Requirements:**
- Decorator applied to a class property
- Accepts a resolver function `(doc: T) => any`
- Registers the virtual on the underlying Mongoose schema via metadata
- Virtuals are included in `.toJSON()` and `.toObject()` output by default

---

## 4. `@Repository` Decorator

Marks a class as a repository tied to a specific entity (schema class). Injects the Mongoose model and extends `BaseRepository<T>`.

```typescript
@Repository(User)
class UserRepository extends BaseRepository<IUser> {
  // inherits: find, findOne, findById, findAll, save, update, delete
  // also has: this.model (direct Mongoose Model access)
}
```

**Requirements:**
- Accepts the entity class (decorated with `@Schema`) as argument
- Reads schema metadata from the entity class via `reflect-metadata`
- Registers the Mongoose model and injects it into `this.model`
- The decorated class must extend `BaseRepository<T>`

---

## 5. `BaseRepository<T>`

Abstract generic class providing standard CRUD operations and query builder integration.

```typescript
abstract class BaseRepository<T> {
  protected model: Model<T>

  async find(query?: BuiltQuery<T>): Promise<T[]>
  async findOne(query?: BuiltQuery<T>): Promise<T | null>
  async findById(id: string): Promise<T | null>
  async findAll(query?: BuiltQuery<T>, pageable?: Pageable): Promise<PageResult<T>>
  async save(data: Partial<T>, options?: { actorId?: string }): Promise<T>
  async update(id: string, data: Partial<T>, options?: { actorId?: string }): Promise<T | null>
  async delete(id: string): Promise<boolean>
}
```

**Requirements:**
- `find`, `findOne`, and `findAll` accept an optional `BuiltQuery<T>` — the resolved output of `CustomBuilder.build()`
- `findAll` additionally accepts an optional `Pageable` for pagination; if omitted, return all results wrapped in `PageResult` with `page: 1` and `totalPages: 1`
- `this.model` is accessible in subclasses (protected), direct Mongoose model access is allowed
- `save()` sets `createdBy` and `updatedBy` from `options.actorId` if provided, otherwise `null`
- `update()` sets only `updatedBy` from `options.actorId` if provided, otherwise `null`

---

## 6. `Pageable`

Input class representing pagination and sorting parameters.

```typescript
class Pageable {
  page: number          // 1-based page number
  size: number          // items per page
  sort?: string         // field name to sort by
  order?: "asc" | "desc"

  static of(page: number, size: number, sort?: string, order?: "asc" | "desc"): Pageable
}
```

**Usage:**
```typescript
const pageable = Pageable.of(1, 10, "createdAt", "desc")
const result = await userRepo.findAll(builder.build(), pageable)
```

---

## 7. `PageResult<T>`

Wrapper for paginated query results.

```typescript
class PageResult<T> {
  content: T[]          // data for the current page
  page: number          // current page (1-based)
  size: number          // items per page
  total: number         // total number of matching documents
  totalPages: number    // Math.ceil(total / size)
  hasPrev: boolean      // page > 1
  hasNext: boolean      // page < totalPages
}
```

**Example response:**
```json
{
  "content": [{ "_id": "...", "firstName": "Dudi", "profile": null }],
  "page": 1,
  "size": 10,
  "total": 42,
  "totalPages": 5,
  "hasPrev": false,
  "hasNext": true
}
```

---

## 8. `CustomOperation` Enum

```typescript
enum CustomOperation {
  // Equality
  EQUAL = "equal",
  NOT_EQUAL = "not_equal",

  // Comparison
  GT = "gt",
  GTE = "gte",
  LT = "lt",
  LTE = "lte",

  // String
  LIKE = "like",              // regex contains (case-insensitive)
  STARTS_WITH = "starts_with",
  ENDS_WITH = "ends_with",

  // Array
  IN = "in",
  NOT_IN = "not_in",

  // Relational (triggers $lookup into another collection)
  OPERATION_JOIN_EQUAL = "join_equal",
  OPERATION_JOIN_LIKE = "join_like",
  OPERATION_JOIN_IN = "join_in",
  OPERATION_JOIN_GT = "join_gt",
  OPERATION_JOIN_GTE = "join_gte",
  OPERATION_JOIN_LT = "join_lt",
  OPERATION_JOIN_LTE = "join_lte",
}
```

Any operation prefixed with `OPERATION_JOIN_` signals that the field path crosses a collection boundary and must be resolved via MongoDB `$lookup`.

---

## 9. `SearchCustom`

Represents a single search condition.

```typescript
class SearchCustom {
  static of(field: string, operation: CustomOperation, value: any): SearchCustom

  static readonly OPERATION_AND = "AND"
  static readonly OPERATION_OR = "OR"
}
```

**Field path rules:**
- Simple field: `"firstName"` → direct `$match` on current collection
- Dot notation with join: `"user.profile.nama"` → parsed as:
  - `user` = current collection alias
  - `profile` = foreign collection to `$lookup`
  - `nama` = field to match inside the foreign collection
- The parser must detect `OPERATION_JOIN_*` operations and resolve the appropriate `$lookup` + `$match` pipeline stages automatically

---

## 10. `MultipleSearch`

Combines multiple `SearchCustom` conditions with a logical operator.

```typescript
class MultipleSearch {
  static of(
    operator: typeof SearchCustom.OPERATION_AND | typeof SearchCustom.OPERATION_OR,
    ...conditions: SearchCustom[]
  ): MultipleSearch
}
```

**Example:**
```typescript
MultipleSearch.of(
  SearchCustom.OPERATION_AND,
  SearchCustom.of("age", CustomOperation.GTE, 18),
  SearchCustom.of("user.profile.city", CustomOperation.OPERATION_JOIN_EQUAL, "Jakarta")
)
```

---

## 11. `CustomBuilder<T>`

Main fluent builder that accumulates conditions **incrementally** and resolves them into a Mongoose aggregation pipeline via `.build()`.

```typescript
type BuiltQuery<T> = {
  pipeline: PipelineStage[]
}

class CustomBuilder<T> {
  with(condition: SearchCustom | MultipleSearch): this
  build(): BuiltQuery<T>
}
```

**Key design — incremental condition building:**

Conditions are added one by one, allowing dynamic filter construction based on runtime input (e.g. user-provided filters from a HTTP request). `.build()` is only called **once** after all conditions are accumulated:

```typescript
const builder = new CustomBuilder<IUser>()

if (filter.name) {
  builder.with(SearchCustom.of("firstName", CustomOperation.LIKE, filter.name))
}

if (filter.city) {
  builder.with(
    SearchCustom.of("user.profile.city", CustomOperation.OPERATION_JOIN_EQUAL, filter.city)
  )
}

if (filter.minAge !== undefined && filter.maxAge !== undefined) {
  builder.with(
    MultipleSearch.of(
      SearchCustom.OPERATION_AND,
      SearchCustom.of("age", CustomOperation.GTE, filter.minAge),
      SearchCustom.of("age", CustomOperation.LTE, filter.maxAge)
    )
  )
}

// Build once — resolves all accumulated conditions into a pipeline
const query = builder.build()

// Pass to repository methods
const users = await userRepo.find(query)
const pagedUsers = await userRepo.findAll(query, Pageable.of(1, 10, "createdAt", "desc"))
```

**Pipeline resolution rules:**
- Simple field conditions → `$match` stage
- Join field conditions → `$lookup` stage (auto-resolved from dot-notation path) + `$match` inside `$lookup.pipeline`
- Multiple conditions AND → combined with `$and` inside `$match`
- Multiple conditions OR → combined with `$or` inside `$match`
- Duplicate `$lookup` targeting the same foreign collection must be **merged** into a single stage — never duplicated
- `build()` is a pure resolver with no side effects — calling it multiple times must produce the same result

---

## 12. Zod Schema Integration

Every entity must define a corresponding **Zod schema** for runtime validation and type inference.

**Rules:**
- Extend `BaseEntitySchema` (exported by `mongo-kit`) for all entity schemas
- All relation fields (populated via `$lookup`) must be `.nullable()` — `null` when not joined, populated object when joined
- Non-relation fields are required by default unless explicitly optional
- Virtual fields (from `@VirtualField`) are included in the Zod schema
- Use `z.lazy()` for circular/self-referencing schemas

**Example:**
```typescript
// provided by mongo-kit
const BaseEntitySchema = z.object({
  _id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

// profile.types.ts (consumer app)
const IProfileSchema = BaseEntitySchema.extend({
  nama: z.string(),
  city: z.string(),
})
export type IProfile = z.infer<typeof IProfileSchema>

// user.types.ts (consumer app)
const IUserSchema = BaseEntitySchema.extend({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),               // virtual field
  age: z.number(),
  profile: IProfileSchema.nullable(), // null if not joined, populated if joined
})
export type IUser = z.infer<typeof IUserSchema>
```

---

## 13. Full Usage Example (for README.md)

```typescript
import "reflect-metadata"
import {
  Schema, VirtualField, Repository, BaseRepository, BaseEntity, BaseEntitySchema,
  CustomBuilder, SearchCustom, MultipleSearch, CustomOperation,
  Pageable
} from "@workspace/mongo-kit"
import { z } from "zod"

// ── 1. Define Entities ────────────────────────────────────────────

@Schema({ collection: "profiles", timestamps: true })
class Profile extends BaseEntity {
  nama: string
  city: string
}

@Schema({ collection: "users", timestamps: true })
class User extends BaseEntity {
  @VirtualField((doc) => `${doc.firstName} ${doc.lastName}`)
  fullName: string

  firstName: string
  lastName: string
  age: number
}

// ── 2. Define Zod Schemas & Types ─────────────────────────────────

const IProfileSchema = BaseEntitySchema.extend({
  nama: z.string(),
  city: z.string(),
})
type IProfile = z.infer<typeof IProfileSchema>

const IUserSchema = BaseEntitySchema.extend({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  age: z.number(),
  profile: IProfileSchema.nullable(), // null if not joined
})
type IUser = z.infer<typeof IUserSchema>

// ── 3. Define Repository ──────────────────────────────────────────

@Repository(User)
class UserRepository extends BaseRepository<IUser> {

  async findByName(name: string): Promise<IUser[]> {
    const builder = new CustomBuilder<IUser>()
      .with(SearchCustom.of("firstName", CustomOperation.LIKE, name))
    return this.find(builder.build())
  }

  async findWithProfile(nama: string): Promise<IUser[]> {
    const builder = new CustomBuilder<IUser>()
      .with(SearchCustom.of("user.profile.nama", CustomOperation.OPERATION_JOIN_EQUAL, nama))
    return this.find(builder.build())
  }

  async search(filter: {
    name?: string
    city?: string
    minAge?: number
    maxAge?: number
  }, page: number, size: number) {
    const builder = new CustomBuilder<IUser>()

    if (filter.name) {
      builder.with(SearchCustom.of("firstName", CustomOperation.LIKE, filter.name))
    }

    if (filter.city) {
      builder.with(
        SearchCustom.of("user.profile.city", CustomOperation.OPERATION_JOIN_EQUAL, filter.city)
      )
    }

    if (filter.minAge !== undefined && filter.maxAge !== undefined) {
      builder.with(
        MultipleSearch.of(
          SearchCustom.OPERATION_AND,
          SearchCustom.of("age", CustomOperation.GTE, filter.minAge),
          SearchCustom.of("age", CustomOperation.LTE, filter.maxAge)
        )
      )
    }

    return this.findAll(builder.build(), Pageable.of(page, size, "createdAt", "desc"))
  }
}

// ── 4. Use Repository ─────────────────────────────────────────────

const userRepo = new UserRepository()

// Save with actor (e.g. from authenticated request)
const newUser = await userRepo.save(
  { firstName: "Dudi", lastName: "Setiawan", age: 25 },
  { actorId: "admin_user_id" }
)

// Save from system — no actor, createdBy/updatedBy will be null
const systemUser = await userRepo.save({ firstName: "System", lastName: "Bot", age: 0 })

// Update with actor
await userRepo.update(newUser._id, { age: 26 }, { actorId: "admin_user_id" })

// Paginated search with dynamic filters
const result = await userRepo.search({ city: "Jakarta", minAge: 18, maxAge: 35 }, 1, 10)

console.log(result)
// {
//   content: [{ _id: "...", firstName: "Dudi", fullName: "Dudi Setiawan", profile: { nama: "...", city: "Jakarta" }, createdBy: "admin_user_id", updatedBy: null, ... }],
//   page: 1,
//   size: 10,
//   total: 24,
//   totalPages: 3,
//   hasPrev: false,
//   hasNext: true
// }
```

---

## Output Requirements

1. Implement all files in `src/` with full TypeScript types — no `any` unless absolutely necessary
2. Export everything cleanly from `src/index.ts`
3. Write `README.md` with the full usage example above
4. Write `package.json` configured for ESM + CJS dual output
5. Write `tsconfig.json` with strict mode and decorator support enabled
6. Add inline JSDoc comments on all public classes and methods
7. Do NOT use `any` as escape hatch — use generics and proper typing throughout
8. Handle edge cases:
   - Missing metadata on entity class → throw descriptive error
   - Invalid or malformed dot-notation field paths → throw descriptive error
   - Unregistered schemas passed to `@Repository` → throw descriptive error
   - `findAll` called without `Pageable` → return all results wrapped in `PageResult` with `page: 1`, `totalPages: 1`
   - `save` / `update` called without `actorId` → `createdBy` / `updatedBy` set to `null`
   - `build()` called multiple times → must always produce the same deterministic result
