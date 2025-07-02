import { Route, Routes } from 'react-router-dom';
import { ParseableLogstreamPage } from './ParseableLogstreamPage';
import { Entity } from '@backstage/catalog-model';
import { MissingAnnotationEmptyState } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import React from 'react';
// Define the annotation constant directly here
const PARSEABLE_ANNOTATION_BASE_URL = 'parseable.io/base-url';

export const isParseableLogstreamAvailable = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.[PARSEABLE_ANNOTATION_BASE_URL]);

export const Router = () => {
  const { entity } = useEntity();

  // Check if the entity has the required annotation
  if (!isParseableLogstreamAvailable(entity)) {
    return (
      <MissingAnnotationEmptyState
        annotation={PARSEABLE_ANNOTATION_BASE_URL}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<ParseableLogstreamPage />} />
    </Routes>
  );
};
