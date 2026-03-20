import type { TimeTrackingParser, ParserMetadata } from './types.js';

/**
 * Registry for managing available time tracking parsers
 */
export class ParserRegistry {
  private parsers = new Map<string, TimeTrackingParser>();

  /**
   * Register a parser
   */
  register(parser: TimeTrackingParser): void {
    this.parsers.set(parser.metadata.name, parser);
  }

  /**
   * Get a parser by name
   */
  get(name: string): TimeTrackingParser | undefined {
    return this.parsers.get(name);
  }

  /**
   * Check if a parser is registered
   */
  has(name: string): boolean {
    return this.parsers.has(name);
  }

  /**
   * List all registered parsers
   */
  list(): TimeTrackingParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * List all parser metadata
   */
  listMetadata(): ParserMetadata[] {
    return this.list().map(p => p.metadata);
  }

  /**
   * Find parser by file extension
   */
  findByExtension(extension: string): TimeTrackingParser | undefined {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return this.list().find(p => 
      p.metadata.supportedExtensions.includes(ext)
    );
  }

  /**
   * Unregister a parser
   */
  unregister(name: string): boolean {
    return this.parsers.delete(name);
  }

  /**
   * Clear all parsers
   */
  clear(): void {
    this.parsers.clear();
  }
}

/**
 * Create a new parser registry
 */
export function createParserRegistry(): ParserRegistry {
  return new ParserRegistry();
}

/**
 * Global parser registry instance
 */
export const globalParserRegistry = createParserRegistry();
