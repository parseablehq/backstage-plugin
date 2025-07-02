import { z } from 'zod';
import { ConfigApi, FetchApi, IdentityApi } from '@backstage/core-plugin-api';

// Types for the Parseable API responses
export interface ParseableUserResponse {
  username: string;
  datasets: string[];
}

export interface ParseableSchemaResponse {
  name: string;
  schema: Record<string, unknown>;
}

// Schema for validating log entries from the query API
const LogEntrySchema = z.object({
  // Common fields from the sample response
  address: z.string().optional(),
  commit: z.string().optional(),
  event_time: z.string().optional(),
  event_type: z.string().optional(),
  node_type: z.string().optional(),
  p_format: z.string().optional(),
  p_timestamp: z.string().optional(),
  p_user_agent: z.string().optional(),
  
  // Metrics fields
  parseable_deleted_events_ingested: z.number().optional(),
  parseable_deleted_events_ingested_size: z.number().optional(),
  parseable_events_ingested: z.number().optional(),
  parseable_events_ingested_size: z.number().optional(),
  parseable_lifetime_events_ingested: z.number().optional(),
  parseable_lifetime_events_ingested_size: z.number().optional(),
  parseable_staging_files: z.number().optional(),
  process_resident_memory_bytes: z.number().optional(),
  staging: z.string().optional(),
  
  // Nested objects
  parseable_deleted_storage_size: z.object({
    staging: z.number().optional(),
    data: z.number().optional()
  }).optional(),
  parseable_lifetime_storage_size: z.object({
    staging: z.number().optional(),
    data: z.number().optional()
  }).optional(),
  parseable_storage_size: z.object({
    staging: z.number().optional(),
    data: z.number().optional()
  }).optional(),
  
  // Catch-all for other fields
  // This allows the schema to accept any additional fields not explicitly defined
}).passthrough();

export type LogEntry = z.infer<typeof LogEntrySchema>;

export interface ParseableClientOptions {
  fetchApi: FetchApi;
  identityApi: IdentityApi;
  configApi: ConfigApi;
}

export class ParseableClient {
  private readonly fetchApi: FetchApi;
  private readonly identityApi: IdentityApi;
  private readonly configApi: ConfigApi;

  constructor(options: ParseableClientOptions) {
    this.fetchApi = options.fetchApi;
    this.identityApi = options.identityApi;
    this.configApi = options.configApi;
  }

  // This method is intentionally left empty as we get the base URL directly from the entity annotation

  /**
   * Get the authorization header for Parseable API requests
   */
  private async getAuthHeader(baseUrl?: string): Promise<Headers> {
    const headers = new Headers();
    
    // If this is the demo server, use the default admin/admin credentials
    if (baseUrl && baseUrl.includes('demo.parseable.com')) {
      // admin:admin in base64 is YWRtaW46YWRtaW4=
      headers.set('Authorization', 'Basic YWRtaW46YWRtaW4=');
      return headers;
    }
    
    try {
      const parseableCredential = this.configApi.getString('parseable.basicAuthCredential');
      headers.set('Authorization', `Basic ${parseableCredential}`);
    } catch (e) {
      throw new Error('Failed to get Parseable credentials from config. Make sure PARSEABLE_B64_CRED is set.');
    }
    
    return headers;
  }

  /**
   * Get user information and available datasets
   */
  async getUserInfo(baseUrl: string): Promise<ParseableUserResponse> {
    // Get identity from Backstage (for username)
    const identity = await this.identityApi.getBackstageIdentity();
    const username = identity.userEntityRef.split('/')[1];
    
    // Get auth headers with the appropriate credentials
    const headers = await this.getAuthHeader(baseUrl);
    
    // Directly fetch the list of datasets using the correct endpoint
    const url = `${baseUrl}/api/v1/logstream`;
    
    try {
      const response = await this.fetchApi.fetch(url, {
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your Parseable credentials.');
        }
        throw new Error(`Failed to fetch datasets: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate that we got an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from Parseable API: expected an array of datasets');
      }
      
      // Extract dataset names from the response
      // The API returns an array of objects with a 'name' property
      // Example: [{ "name": "awsmetrics" }, { "name": "pmeta" }, ...]
      const datasets = data.map(item => {
        if (typeof item === 'object' && item !== null && 'name' in item) {
          return item.name;
        }
        return typeof item === 'string' ? item : '';
      }).filter(Boolean);
      
      // Return in the expected format
      return {
        username: username,
        datasets: datasets,
      };
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error(`Failed to fetch datasets: ${String(e)}`);
    }
  }
  
  /**
   * Get schema for a specific dataset
   */
  async getSchema(baseUrl: string, dataset: string): Promise<ParseableSchemaResponse> {
    // Get auth headers with the appropriate credentials
    const headers = await this.getAuthHeader(baseUrl);
    
    // Fetch the schema for the selected dataset
    const url = `${baseUrl}/api/v1/logstream/${dataset}/schema`;
    
    try {
      const response = await this.fetchApi.fetch(url, {
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your Parseable credentials.');
        }
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        name: dataset,
        schema: data,
      };
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error(`Failed to fetch schema: ${String(e)}`);
    }
  }

  /**
   * Get logs for a specific dataset using PostgreSQL syntax
   */
  async getLogs(
    baseUrl: string, 
    dataset: string, 
    limit: number = 100, 
    query?: string, 
    startTime?: string, 
    endTime?: string
  ): Promise<LogEntry[]> {
    const headers = await this.getAuthHeader(baseUrl);
    const requestHeaders = new Headers(headers);
    requestHeaders.set('content-type', 'application/json');
    
    // If no time range is provided, default to last 5 minutes
    if (!startTime || !endTime) {
      const now = new Date();
      endTime = now.toISOString();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      startTime = fiveMinutesAgo.toISOString();
    }
    
    // We'll use ISO format timestamps directly in the SQL query
    // but keep the original ISO strings for the request body
    
    // Build the SQL query with proper PostgreSQL syntax
    let sqlQuery = `SELECT * FROM ${dataset}`;
    
    // Add WHERE clause for search query if provided
    const whereConditions = [];
    
    // Add search query condition if provided
    if (query && query.trim() !== '') {
      // If the query is a simple text search, wrap it in a LIKE clause
      if (!query.includes('=') && !query.includes('<') && !query.includes('>') && 
          !query.toLowerCase().includes(' and ') && !query.toLowerCase().includes(' or ')) {
        // Search in all fields using ILIKE for case-insensitive search
        whereConditions.push(`body ILIKE '%${query}%'`);
      } else {
        // User provided a more complex query, use it as is
        whereConditions.push(query);
      }
    }
    
    // Add time range conditions
    if (startTime) {
      whereConditions.push(`p_timestamp >= '${startTime}'`);
    }
    
    if (endTime) {
      whereConditions.push(`p_timestamp <= '${endTime}'`);
    }
    
    // Combine all WHERE conditions
    if (whereConditions.length > 0) {
      sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Add ORDER BY to get newest logs first
    sqlQuery += ` ORDER BY p_timestamp DESC`;
    
    // Add limit to the query if specified
    if (limit && limit > 0) {
      sqlQuery += ` LIMIT ${limit}`;
    }
    
    const requestBody = {
      query: sqlQuery,
      streamName: dataset,
      startTime: startTime || '',
      endTime: endTime || ''
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
      console.log('Executing query:', sqlQuery);
      
      const response = await this.fetchApi.fetch(`${baseUrl}/api/v1/query`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your Parseable credentials.');
        }
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data.map(entry => LogEntrySchema.parse(entry)) : [];
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error(`Invalid log format from Parseable API: ${e.message}`);
      }
      throw e;
    }
  }

  /**
   * Get logs directly from the logstream API
   * This is a simpler approach that doesn't use the query API
   */
  async getLogsByStream(
    baseUrl: string,
    dataset: string,
    limit: number = 100
  ): Promise<LogEntry[]> {
    const headers = await this.getAuthHeader(baseUrl);
    
    try {
      // Use the logstream API endpoint directly
      const url = `${baseUrl}/api/v1/logstream/${dataset}/logs?limit=${limit}`;
      
      console.log('Fetching logs from logstream API:', url);
      
      const response = await this.fetchApi.fetch(url, {
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your Parseable credentials.');
        }
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data.map(entry => LogEntrySchema.parse(entry)) : [];
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error(`Invalid log format from Parseable API: ${e.message}`);
      }
      throw e;
    }
  }

  /**
   * Export logs to CSV
   */
  async exportToCsv(baseUrl: string, dataset: string, query?: string): Promise<Blob> {
    const headers = await this.getAuthHeader(baseUrl);
    let url = `${baseUrl}/api/v1/logstream/${dataset}/csv`;
    
    if (query) {
      url += `?q=${encodeURIComponent(query)}`;
    }
    
    try {
      const response = await this.fetchApi.fetch(url, {
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please check your Parseable credentials.');
        }
        throw new Error(`Failed to export logs: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (e) {
      throw new Error(`Failed to export logs to CSV: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
