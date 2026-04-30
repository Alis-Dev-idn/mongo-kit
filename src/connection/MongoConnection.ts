import mongoose from 'mongoose';
import type { ConnectOptions } from 'mongoose';

/**
 * Connection options for MongoConnection.
 */
export interface MongoConnectionOptions {
  /** MongoDB connection URI (e.g., `mongodb://localhost:27017/mydb`) */
  uri: string;
  /** Mongoose connection options */
  options?: ConnectOptions;
  /** Enable debug mode (logs all queries) */
  debug?: boolean;
  /** Callback invoked on successful connection */
  onConnected?: () => void;
  /** Callback invoked on connection error */
  onError?: (error: Error) => void;
  /** Callback invoked on disconnection */
  onDisconnected?: () => void;
}

/**
 * MongoDB connection manager for `mongo-kit`.
 *
 * Provides a centralized way to connect, disconnect, and monitor
 * the MongoDB connection lifecycle.
 *
 * @example
 * ```typescript
 * // Simple connection
 * await MongoConnection.connect({
 *   uri: 'mongodb://localhost:27017/mydb',
 * });
 *
 * // With options and lifecycle callbacks
 * await MongoConnection.connect({
 *   uri: 'mongodb://localhost:27017/mydb',
 *   debug: true,
 *   options: {
 *     maxPoolSize: 10,
 *     serverSelectionTimeoutMS: 5000,
 *   },
 *   onConnected: () => console.log('✅ MongoDB connected'),
 *   onError: (err) => console.error('❌ MongoDB error:', err),
 *   onDisconnected: () => console.log('⚠️ MongoDB disconnected'),
 * });
 *
 * // Disconnect
 * await MongoConnection.disconnect();
 *
 * // Get the underlying Mongoose instance
 * const mongooseInstance = MongoConnection.getMongoose();
 * ```
 */
export class MongoConnection {
  private static _isConnected = false;

  /**
   * Connects to MongoDB using the provided options.
   *
   * @param config - Connection configuration
   * @throws Error if the connection fails
   */
  static async connect(config: MongoConnectionOptions): Promise<typeof mongoose> {
    const { uri, options, debug, onConnected, onError, onDisconnected } = config;

    if (!uri || uri.trim().length === 0) {
      throw new Error('[mongo-kit] MongoConnection.connect: URI must not be empty');
    }

    // Enable debug mode if requested
    if (debug) {
      mongoose.set('debug', true);
    }

    // Register event listeners
    mongoose.connection.on('connected', () => {
      MongoConnection._isConnected = true;
      onConnected?.();
    });

    mongoose.connection.on('error', (err: Error) => {
      onError?.(err);
    });

    mongoose.connection.on('disconnected', () => {
      MongoConnection._isConnected = false;
      onDisconnected?.();
    });

    // Connect
    try {
      await mongoose.connect(uri, {
        ...options,
      });
      MongoConnection._isConnected = true;
      return mongoose;
    } catch (error) {
      MongoConnection._isConnected = false;
      throw new Error(
        `[mongo-kit] MongoConnection.connect: Failed to connect to MongoDB at "${uri}". ` +
        `Error: ${(error as Error).message}`
      );
    }
  }

  /**
   * Disconnects from MongoDB gracefully.
   */
  static async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      MongoConnection._isConnected = false;
    }
  }

  /**
   * Checks if the MongoDB connection is active.
   *
   * @returns `true` if connected, `false` otherwise
   */
  static isConnected(): boolean {
    return MongoConnection._isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Returns the underlying Mongoose instance for advanced use cases.
   */
  static getMongoose(): typeof mongoose {
    return mongoose;
  }

  /**
   * Returns the current connection state as a human-readable string.
   */
  static getState(): 'disconnected' | 'connected' | 'connecting' | 'disconnecting' {
    switch (mongoose.connection.readyState) {
      case 0: return 'disconnected';
      case 1: return 'connected';
      case 2: return 'connecting';
      case 3: return 'disconnecting';
      default: return 'disconnected';
    }
  }
}
