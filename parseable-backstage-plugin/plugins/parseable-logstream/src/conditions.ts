import { Entity } from '@backstage/catalog-model';

/**
 * Checks if the Parseable logstream integration is available for the given entity.
 * An entity is considered to have Parseable logstream available if it has the
 * 'parseable.io/base-url' annotation.
 *
 * @public
 */
export const isParseableLogstreamAvailable = (entity: Entity): boolean => {
  return Boolean(entity.metadata.annotations?.['parseable.io/base-url']);
};
