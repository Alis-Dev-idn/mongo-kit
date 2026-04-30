# @alisdev/mongo-kit

> Decorator-based MongoDB schema & repository library with fluent query builder, soft delete, hard delete, TTL, custom indexes, and auto-populate relations.

## Features

- 🔌 **MongoDB Connection** — `MongoConnection` utility with lifecycle callbacks
- 🏗️ **Decorator-based Schema** — `@Schema`, `@VirtualField`, `@Repository`
- 🔗 **Auto-Populate Relations** — `@Relation` decorator for automatic `$lookup`
- 🔍 **Fluent Query Builder** — Incremental condition building with `$lookup` support
- 📄 **Pageable** — Built-in pagination with `Pageable` and `PageResult`
- 🗑️ **Soft Delete** — `softDelete()`, `restore()`, auto-filtering
- 💥 **Hard Delete** — `delete()` / `hardDelete()` for permanent removal
- ⏰ **TTL (Time-To-Live)** — `@TTL` decorator + per-document `expireAt`
- 📇 **Custom Indexes** — `@Index` decorator for unique, compound, text, and geospatial indexes
- ✅ **Zod Integration** — `BaseEntitySchema` for runtime validation
- 🔒 **Audit Fields** — `createdBy`, `updatedBy`, `deletedBy` with actor tracking

## Installation

```bash
npm install @alisdev/mongo-kit
```

## Quick Start

```typescript
import "reflect-metadata";
import {
  MongoConnection,
  Schema, VirtualField, Repository, Relation, Index, TTL,
  BaseRepository, BaseEntity, BaseEntitySchema,
  CustomBuilder, SearchCustom, MultipleSearch, CustomOperation,
  Pageable
} from "@alisdev/mongo-kit";
import { z } from "zod";
```

---

## 1. Connect to MongoDB

```typescript
// Simple connection
await MongoConnection.connect({
  uri: "mongodb://localhost:27017/mydb",
});

// With full options
await MongoConnection.connect({
  uri: process.env.MONGODB_URI!,
  debug: process.env.NODE_ENV === "development",
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  },
  onConnected: () => console.log("✅ MongoDB connected"),
  onError: (err) => console.error("❌ MongoDB error:", err),
  onDisconnected: () => console.log("⚠️ MongoDB disconnected"),
});

// Check connection state
console.log(MongoConnection.isConnected()); // true
console.log(MongoConnection.getState());    // 'connected'

// Disconnect gracefully
await MongoConnection.disconnect();
```

---

## 2. Define Entities

```typescript
@Schema({ collection: "profiles", timestamps: true })
class Profile extends BaseEntity {
  nama: string;
  city: string;
}

@Index({ email: 1 }, { unique: true })
@Index({ firstName: "text", lastName: "text" })
@Schema({ collection: "users", timestamps: true })
class User extends BaseEntity {
  @VirtualField((doc) => `${doc.firstName} ${doc.lastName}`)
  fullName: string;

  firstName: string;
  lastName: string;
  email: string;
  age: number;

  // Auto-populate: profile will be automatically joined on every query
  @Relation({ collection: "profiles", localField: "profileId" })
  profile: IProfile | null;
}

// TTL example — sessions expire 30 days after creation
@TTL("createdAt", 2592000)
@Schema({ collection: "sessions", timestamps: true })
class Session extends BaseEntity {
  token: string;
  userId: string;
}
```

---

## 3. Define Zod Schemas & Types

```typescript
const IProfileSchema = BaseEntitySchema.extend({
  nama: z.string(),
  city: z.string(),
});
type IProfile = z.infer<typeof IProfileSchema>;

const IUserSchema = BaseEntitySchema.extend({
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string(),
  age: z.number(),
  profile: IProfileSchema.nullable(), // null if not joined
});
type IUser = z.infer<typeof IUserSchema>;
```

---

## 4. Define Repository

```typescript
@Repository(User)
class UserRepository extends BaseRepository<IUser> {

  async findByName(name: string): Promise<IUser[]> {
    const builder = new CustomBuilder<IUser>()
      .with(SearchCustom.of("firstName", CustomOperation.LIKE, name));
    return this.find(builder.build());
  }

  async search(filter: {
    name?: string;
    city?: string;
    minAge?: number;
    maxAge?: number;
  }, page: number, size: number) {
    const builder = new CustomBuilder<IUser>();

    if (filter.name) {
      builder.with(SearchCustom.of("firstName", CustomOperation.LIKE, filter.name));
    }

    if (filter.city) {
      builder.with(
        SearchCustom.of("user.profile.city", CustomOperation.OPERATION_JOIN_EQUAL, filter.city)
      );
    }

    if (filter.minAge !== undefined && filter.maxAge !== undefined) {
      builder.with(
        MultipleSearch.of(
          SearchCustom.OPERATION_AND,
          SearchCustom.of("age", CustomOperation.GTE, filter.minAge),
          SearchCustom.of("age", CustomOperation.LTE, filter.maxAge)
        )
      );
    }

    return this.findAll(builder.build(), Pageable.of(page, size, "createdAt", "desc"));
  }
}
```

---

## 5. Usage

### Auto-Populate Relations (tanpa builder!)

```typescript
const userRepo = new UserRepository();

// findById — profile otomatis terbawa!
const user = await userRepo.findById("some-id");
// {
//   _id: "some-id",
//   firstName: "Dudi",
//   profile: { _id: "...", nama: "Dudi S", city: "Jakarta" },  ← auto-populated!
//   ...
// }

// find() — semua user beserta profile-nya
const users = await userRepo.find();
// [{ _id: "...", firstName: "Dudi", profile: { ... } }, ...]

// findAll() dengan pagination — profile juga terbawa
const paged = await userRepo.findAll(undefined, Pageable.of(1, 10));
// { content: [{ profile: { ... }, ... }], page: 1, total: 42, ... }
```

### @Relation Options

```typescript
// belongsTo (default) — hasil: single object atau null
@Relation({ collection: "profiles", localField: "profileId" })
profile: IProfile | null;

// hasMany — hasil: array
@Relation({
  collection: "orders",
  localField: "_id",
  foreignField: "userId",
  type: "hasMany"
})
orders: IOrder[];
```

### Save

```typescript
// Save with actor
const newUser = await userRepo.save(
  { firstName: "Dudi", lastName: "Setiawan", email: "dudi@email.com", age: 25, profileId: "profile_id" },
  { actorId: "admin_user_id" }
);

// Save from system — createdBy/updatedBy will be null
const systemUser = await userRepo.save(
  { firstName: "System", lastName: "Bot", email: "system@bot.com", age: 0 }
);

// Save with TTL — document expires in 1 hour
const tempUser = await userRepo.save(
  { firstName: "Temp", lastName: "User", email: "temp@email.com", age: 0 },
  { ttl: 3600 }
);

// Save with exact expiry date
const scheduledUser = await userRepo.save(
  { firstName: "Scheduled", lastName: "User", email: "sched@email.com", age: 0 },
  { expireAt: new Date("2025-12-31T23:59:59Z") }
);
```

### Update

```typescript
await userRepo.update(newUser._id, { age: 26 }, { actorId: "admin_user_id" });
```

### Soft Delete & Restore

```typescript
// Soft delete — document hidden from standard queries
await userRepo.softDelete(newUser._id, { actorId: "admin_user_id" });

// Find only soft-deleted documents (with relations auto-populated)
const deleted = await userRepo.findOnlyDeleted();

// Include soft-deleted in queries (with relations auto-populated)
const all = await userRepo.findWithDeleted();

// Restore a soft-deleted document
await userRepo.restore(newUser._id, { actorId: "admin_user_id" });
```

### Hard Delete

```typescript
// Permanently remove from database (irreversible)
await userRepo.delete(newUser._id);
// or
await userRepo.hardDelete(newUser._id);
```

### Paginated Search

```typescript
const result = await userRepo.search(
  { city: "Jakarta", minAge: 18, maxAge: 35 },
  1,
  10
);
// {
//   content: [{ _id: "...", firstName: "Dudi", profile: { ... }, ... }],
//   page: 1, size: 10, total: 24, totalPages: 3,
//   hasPrev: false, hasNext: true
// }
```

---

## 6. Indexes

```typescript
// Unique index
@Index({ email: 1 }, { unique: true })

// Compound index
@Index({ category: 1, price: -1 })

// Text search index
@Index({ firstName: "text", lastName: "text" })

// Geospatial index
@Index({ location: "2dsphere" })

// Sparse index
@Index({ optionalField: 1 }, { sparse: true })

@Schema({ collection: "products" })
class Product extends BaseEntity { ... }
```

---

## 7. TTL (Time-To-Live)

### Entity-level TTL

```typescript
// Documents expire 24 hours after creation
@TTL("createdAt", 86400)
@Schema({ collection: "otps" })
class OTP extends BaseEntity {
  code: string;
  userId: string;
}
```

### Per-document TTL via `expireAt`

Every entity has an `expireAt` field. Set it during `save()`:

```typescript
// Expires in 5 minutes
await otpRepo.save({ code: "123456", userId: "user1" }, { ttl: 300 });

// Expires at a specific date
await otpRepo.save({ code: "789012", userId: "user2" }, {
  expireAt: new Date("2025-06-01T00:00:00Z")
});
```

> MongoDB's background thread checks TTL indexes every ~60 seconds and removes expired documents automatically.

---

## 8. Query Operations

| Operation | Description | MongoDB Equivalent |
|-----------|-------------|-------------------|
| `EQUAL` | Exact match | `{ field: value }` |
| `NOT_EQUAL` | Not equal | `{ $ne: value }` |
| `GT` | Greater than | `{ $gt: value }` |
| `GTE` | Greater than or equal | `{ $gte: value }` |
| `LT` | Less than | `{ $lt: value }` |
| `LTE` | Less than or equal | `{ $lte: value }` |
| `LIKE` | Case-insensitive contains | `{ $regex: value, $options: 'i' }` |
| `STARTS_WITH` | Starts with | `{ $regex: '^value' }` |
| `ENDS_WITH` | Ends with | `{ $regex: 'value$' }` |
| `IN` | In array | `{ $in: [values] }` |
| `NOT_IN` | Not in array | `{ $nin: [values] }` |
| `IS_NULL` | Is null | `{ field: null }` |
| `IS_NOT_NULL` | Is not null | `{ $ne: null }` |
| `EXISTS` | Field exists | `{ $exists: true }` |
| `NOT_EXISTS` | Field doesn't exist | `{ $exists: false }` |

All operations also have `OPERATION_JOIN_*` variants that trigger `$lookup` for cross-collection queries.

---

## 9. BaseEntity Fields

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | MongoDB document ID |
| `createdAt` | `Date` | Auto-managed by Mongoose |
| `updatedAt` | `Date` | Auto-managed by Mongoose |
| `createdBy` | `string \| null` | Set via `actorId` on save |
| `updatedBy` | `string \| null` | Set via `actorId` on save/update |
| `deletedAt` | `Date \| null` | Set on soft delete, null = active |
| `deletedBy` | `string \| null` | Set on soft delete |
| `expireAt` | `Date \| null` | TTL expiry date |

---

## 10. Connection — Real-World Usage

### Express / NestJS App Bootstrap

```typescript
// src/database.ts
import { MongoConnection } from "@alisdev/mongo-kit";

export async function connectDatabase() {
  await MongoConnection.connect({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/myapp",
    debug: process.env.NODE_ENV === "development",
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
    onConnected: () => console.log("✅ MongoDB connected"),
    onError: (err) => console.error("❌ MongoDB error:", err.message),
    onDisconnected: () => console.log("⚠️ MongoDB disconnected"),
  });
}

// src/app.ts
import express from "express";
import { connectDatabase } from "./database";
import { MongoConnection } from "@alisdev/mongo-kit";

const app = express();

// Connect before starting server
connectDatabase().then(() => {
  app.listen(3000, () => console.log("Server running on :3000"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    db: MongoConnection.isConnected(),         // true/false
    dbState: MongoConnection.getState(),       // 'connected' | 'disconnected' | ...
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await MongoConnection.disconnect();
  process.exit(0);
});
```

### Direct Mongoose Access

```typescript
// If you need the raw mongoose instance
const mongooseInstance = MongoConnection.getMongoose();
// Use for advanced operations like transactions, etc.
```

---

## 11. Relation — Detailed Usage

### belongsTo (Many-to-One)

```typescript
// User has ONE profile → profileId stores the Profile._id
@Schema({ collection: "users" })
class User extends BaseEntity {
  firstName: string;

  @Relation({ collection: "profiles", localField: "profileId" })
  profile: IProfile | null;    // ← single object or null
}

// Usage — profile auto-populated on ALL queries:
const user = await userRepo.findById("user123");
// user.profile = { _id: "...", nama: "Dudi", city: "Jakarta" }  ← auto!

const users = await userRepo.find();
// users[0].profile = { ... }  ← auto!

const paged = await userRepo.findAll(undefined, Pageable.of(1, 10));
// paged.content[0].profile = { ... }  ← auto!
```

### hasMany (One-to-Many)

```typescript
// User has MANY orders → Order.userId references User._id
@Schema({ collection: "users" })
class User extends BaseEntity {
  firstName: string;

  @Relation({
    collection: "orders",
    localField: "_id",           // match User._id
    foreignField: "userId",      // against Order.userId
    type: "hasMany",
  })
  orders: IOrder[];              // ← array of orders
}

// Usage:
const user = await userRepo.findById("user123");
// user.orders = [{ _id: "...", total: 150000 }, { _id: "...", total: 80000 }]
```

### Multiple Relations on One Entity

```typescript
@Schema({ collection: "users" })
class User extends BaseEntity {
  firstName: string;
  lastName: string;

  // belongsTo profile
  @Relation({ collection: "profiles", localField: "profileId" })
  profile: IProfile | null;

  // belongsTo department
  @Relation({ collection: "departments", localField: "departmentId" })
  department: IDepartment | null;

  // hasMany orders
  @Relation({ collection: "orders", localField: "_id", foreignField: "userId", type: "hasMany" })
  orders: IOrder[];
}

// ALL three relations auto-populated on every query:
const user = await userRepo.findById("user123");
// user.profile     = { nama: "Dudi", city: "Jakarta" }
// user.department  = { name: "Engineering" }
// user.orders      = [{ total: 150000 }, { total: 80000 }]
```

### Relation + Query Builder (Combined)

```typescript
@Repository(User)
class UserRepository extends BaseRepository<IUser> {

  // @Relation auto-populates profile on the result
  // CustomBuilder adds filtering logic
  async searchByCity(city: string, page: number, size: number) {
    const builder = new CustomBuilder<IUser>()
      .with(SearchCustom.of(
        "user.profile.city",
        CustomOperation.OPERATION_JOIN_EQUAL,
        city
      ));

    return this.findAll(builder.build(), Pageable.of(page, size));
    // Results have profile auto-populated + filtered by city ✅
  }
}
```

### Without @Relation (Manual Join via Builder)

```typescript
// If you DON'T use @Relation, relations are NOT auto-populated.
// You must explicitly use OPERATION_JOIN_* in CustomBuilder:

@Schema({ collection: "users" })
class User extends BaseEntity {
  firstName: string;
  // No @Relation here — profile NOT auto-populated
}

const userRepo = new UserRepository();

// findById → NO profile data
const user = await userRepo.findById("user123");
// user = { _id: "...", firstName: "Dudi" }  ← no profile!

// To get profile, you must use builder with join:
const builder = new CustomBuilder<IUser>()
  .with(SearchCustom.of("user.profile.city", CustomOperation.OPERATION_JOIN_EQUAL, "Jakarta"));
const users = await userRepo.find(builder.build());
// Now profile data is in the pipeline via $lookup
```

---

## 12. Complete E-Commerce Example

```typescript
import "reflect-metadata";
import {
  MongoConnection, Schema, VirtualField, Repository, Relation,
  Index, TTL, BaseRepository, BaseEntity, BaseEntitySchema,
  CustomBuilder, SearchCustom, CustomOperation, Pageable
} from "@alisdev/mongo-kit";
import { z } from "zod";

// ── Connect ───────────────────────────────────────────────────────
await MongoConnection.connect({ uri: "mongodb://localhost:27017/shop" });

// ── Entities ──────────────────────────────────────────────────────
@Schema({ collection: "categories" })
class Category extends BaseEntity { name: string; }

@Index({ sku: 1 }, { unique: true })
@Index({ name: "text", description: "text" })
@Schema({ collection: "products" })
class Product extends BaseEntity {
  name: string;
  sku: string;
  price: number;
  description: string;

  @Relation({ collection: "categories", localField: "categoryId" })
  category: any;
}

@TTL("createdAt", 900)  // OTP expires in 15 minutes
@Schema({ collection: "otps" })
class OTP extends BaseEntity { code: string; userId: string; }

// ── Types ─────────────────────────────────────────────────────────
const IProductSchema = BaseEntitySchema.extend({
  name: z.string(), sku: z.string(), price: z.number(),
  category: z.object({ name: z.string() }).nullable(),
});
type IProduct = z.infer<typeof IProductSchema>;

// ── Repository ────────────────────────────────────────────────────
@Repository(Product)
class ProductRepository extends BaseRepository<IProduct> {
  async searchProducts(keyword: string, minPrice?: number, maxPrice?: number) {
    const builder = new CustomBuilder<IProduct>();
    builder.with(SearchCustom.of("name", CustomOperation.LIKE, keyword));
    if (minPrice) builder.with(SearchCustom.of("price", CustomOperation.GTE, minPrice));
    if (maxPrice) builder.with(SearchCustom.of("price", CustomOperation.LTE, maxPrice));
    return this.findAll(builder.build(), Pageable.of(1, 20, "price", "asc"));
  }
}

// ── Usage ─────────────────────────────────────────────────────────
const productRepo = new ProductRepository();

// Save with TTL
const product = await productRepo.save(
  { name: "Laptop", sku: "LPT-001", price: 15000000, categoryId: "cat_id" },
  { actorId: "admin_id" }
);

// findById — category auto-populated!
const found = await productRepo.findById(product._id);
// found.category = { _id: "cat_id", name: "Electronics" }  ✅

// Soft delete
await productRepo.softDelete(product._id, { actorId: "admin_id" });

// Restore
await productRepo.restore(product._id, { actorId: "admin_id" });

// Hard delete (permanent)
await productRepo.hardDelete(product._id);

// Disconnect
await MongoConnection.disconnect();
```

---

## License

MIT
