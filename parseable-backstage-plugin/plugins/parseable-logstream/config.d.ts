export interface Config {
  /**
   * Configuration options for the Parseable logstream plugin
   */
  parseable?: {
    /**
     * Base64 encoded credentials for Parseable in the format username:password
     * @visibility secret
     */
    basicAuthCredential: string;
  };
}
