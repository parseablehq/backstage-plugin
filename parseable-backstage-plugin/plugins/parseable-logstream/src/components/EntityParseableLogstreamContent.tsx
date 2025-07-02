import { Grid } from '@material-ui/core';
import { LogStreamCard } from './LogStreamCard';
import React from 'react';
/**
 * Component to render Parseable logstream content on an entity page
 */
export const EntityParseableLogstreamContent = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <LogStreamCard />
      </Grid>
    </Grid>
  );
};
