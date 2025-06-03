import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  Progress,
  ErrorPanel,
  EmptyState,
  Table,
} from '@backstage/core-components';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
  TextField,
  Grid,
  Typography,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import GetAppIcon from '@material-ui/icons/GetApp';
import { useAsync } from 'react-use';
import { parseableApiRef } from '../api';
import type { LogEntry, ParseableSchemaResponse } from '../api/ParseableClient';
import { error } from 'console';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  formControl: {
    minWidth: 200,
  },
  searchField: {
    minWidth: 300,
  },
  logContainer: {
    height: 'calc(100vh - 300px)',
    overflowY: 'auto',
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1),
    fontFamily: 'monospace',
    fontSize: '0.8rem',
  },
  logLine: {
    padding: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  logContent: {
    flexGrow: 1,
    wordBreak: 'break-all',
  },
  copyButton: {
    visibility: 'hidden',
    padding: theme.spacing(0.5),
    '$logLine:hover &': {
      visibility: 'visible',
    },
  },
  timeRangeControls: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  schemaCard: {
    marginBottom: theme.spacing(2),
  },
  logsContainer: {
    marginTop: theme.spacing(2),
  },
  error: {
    color: theme.palette.error.main,
  },
  warn: {
    color: theme.palette.warning.main,
  },
  info: {
    color: theme.palette.info.main,
  },
}));

export const ParseableLogstreamPage = () => {
  const classes = useStyles();
  const parseableClient = useApi(parseableApiRef);
  
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLiveTail, setIsLiveTail] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('https://demo.parseable.com');
  const [schema, setSchema] = useState<ParseableSchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<Error | null>(null);
  
  // Try to get entity context, but don't fail if not available
  const entityContext = (() => {
    try {
      const { entity } = useEntity();
      return { entity, available: true };
    } catch (e) {
      return { entity: undefined, available: false };
    }
  })();
  
  // Set base URL from entity annotation or allow manual input in standalone mode
  useEffect(() => {
    if (entityContext.available && entityContext.entity) {
      const url = entityContext.entity.metadata.annotations?.['parseable.io/base-url'] || '';
      setBaseUrl(url);
    }
  }, [entityContext]);

  // Fetch datasets when base URL changes
  const { loading: datasetsLoading, value: datasets = [], error: datasetsError } = useAsync(
    async () => {
      if (!baseUrl) return [];
      
      try {
        // This will use admin/admin credentials for demo.parseable.com
        const userInfo = await parseableClient.getUserInfo(baseUrl);
        console.log('Fetched datasets:', userInfo.datasets);
        return userInfo.datasets || [];
      } catch (error) {
        console.error('Error fetching datasets:', error);
        throw error;
      }
    },
    [baseUrl]
  );

  // Fetch logs when dataset is selected or during live tail
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchLogs = async () => {
      if (!baseUrl || !selectedDataset) return;
      
      try {
        setLogsLoading(true);
        // Build query string with search terms
        let query = searchQuery;
        
        // Use the updated getLogs method with time range parameters
        const logData = await parseableClient.getLogs(
          baseUrl, 
          selectedDataset, 
          100, 
          query,
          startDate || undefined,
          endDate || undefined
        );
        
        setLogs(logData);
        setError(undefined);
        setLogsLoading(false);
      } catch (err) {
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLiveTail(false);
        setLogsLoading(false);
      }
    };

    // Initial fetch
    if (selectedDataset) {
      fetchLogs();
    }

    // Set up live tail if enabled
    if (isLiveTail && selectedDataset) {
      intervalId = setInterval(fetchLogs, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [baseUrl, selectedDataset, isLiveTail, searchQuery, startDate, endDate, parseableClient]);

  const handleDatasetChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newDataset = event.target.value as string;
    setSelectedDataset(newDataset);
    setLogs([]);
    setError(undefined);
    
    // Fetch schema for the selected dataset
    if (newDataset && baseUrl) {
      setSchemaLoading(true);
      setSchema(null);
      setSchemaError(null);
      
      parseableClient.getSchema(baseUrl, newDataset)
        .then(response => {
          setSchema(response);
          setSchemaLoading(false);
        })
        .catch(err => {
          console.error('Error fetching schema:', err);
          setSchemaError(err instanceof Error ? err : new Error(String(err)));
          setSchemaLoading(false);
        });
    } else {
      setSchema(null);
    }
  };

  const toggleLiveTail = () => {
    setIsLiveTail(!isLiveTail);
  };

  const handleSearch = () => {
    // Trigger a search with the current query
    setIsLiveTail(false); // Stop live tail when searching
  };

  // Helper function to determine log level color based on log properties
  const getLogLevelColor = (log: LogEntry): string => {
    if (!log) return 'inherit';
    
    // Extract level information from various possible fields
    const level = (
      log.level || 
      log.severity || 
      log.event_type || 
      ''
    ).toString().toLowerCase();
    
    // Check for error indicators
    if (level.includes('error')) return '#d32f2f'; // red
    if (level.includes('warn') || level.includes('warning')) return '#f57c00'; // orange
    if (level.includes('info')) return '#0288d1'; // blue
    
    // For Parseable metrics, use blue for normal metrics
    if (level.includes('metrics')) return '#0288d1';
    
    return 'inherit';
  };

  if (logsLoading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Content>
        <ContentHeader title="Parseable Logstream" />
        <ErrorPanel
          error={error}
        >
          Check your Parseable credentials and base URL configuration.
        </ErrorPanel>
      </Content>
    );
  }

  if (datasets.length === 0) {
    return (
      <Content>
        <ContentHeader title="Parseable Logstream" />
        <EmptyState
          missing="data"
          title="No datasets available"
          description="No Parseable datasets found for your user. Make sure you have access to at least one dataset."
        />
      </Content>
    );
  }

  return (
    <Content>
      <ContentHeader title="Parseable Logstream">
        <SupportButton>
          View your Parseable log streams with advanced search capabilities.
        </SupportButton>
      </ContentHeader>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <InfoCard title="Parseable Logs">
            {!entityContext.available && (
              <div style={{ marginBottom: '24px' }}>
                <Typography variant="subtitle1" gutterBottom>
                  You're viewing this plugin in standalone mode. Please enter your Parseable server URL below:
                </Typography>
                <TextField
                  label="Parseable Base URL"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://demo.parseable.com"
                  variant="outlined"
                  size="small"
                  disabled={datasetsLoading}
                />
              </div>
            )}

            <FormControl className={classes.formControl}>
              <InputLabel id="dataset-select-label">Dataset</InputLabel>
              <Select
                labelId="dataset-select-label"
                value={selectedDataset}
                onChange={handleDatasetChange}
                disabled={datasetsLoading || Boolean(datasetsError)}
              >
                <MenuItem value="">
                  <em>Select a dataset</em>
                </MenuItem>
                {datasetsError ? (
                  <MenuItem disabled>Error loading datasets</MenuItem>
                ) : (
                  datasets.map(dataset => (
                    <MenuItem key={dataset} value={dataset}>
                      {dataset}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <div className={classes.timeRangeControls}>
              <div className={classes.timeRangeControls}>
                <TextField
                  label="Start Date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={isLiveTail}
                />
                
                <TextField
                  label="End Date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  disabled={isLiveTail}
                />
              </div>
              
              <TextField
                className={classes.searchField}
                label="Search Query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLiveTail}
              />
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={!selectedDataset || isLiveTail}
              >
                Search
              </Button>
              
              <Tooltip title={isLiveTail ? 'Pause live tail' : 'Start live tail'}>
                <IconButton 
                  onClick={toggleLiveTail} 
                  color={isLiveTail ? 'secondary' : 'default'}
                  disabled={!selectedDataset}
                >
                  {isLiveTail ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
              </Tooltip>
              
              {selectedDataset && (
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<GetAppIcon />}
                  disabled={!selectedDataset}
                  onClick={async () => {
                    try {
                      // Build query string with time range and search terms
                      let query = searchQuery;
                      
                      if (startDate && endDate) {
                        const timeFilter = `timestamp >= "${startDate}" AND timestamp <= "${endDate}"`;
                        query = query ? `${query} AND ${timeFilter}` : timeFilter;
                      }
                      
                      const blob = await parseableClient.exportToCsv(baseUrl, selectedDataset, query);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedDataset}-logs.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      setError(err instanceof Error ? err : new Error(String(err)));
                    }
                  }}
                >
                  Export to CSV
                </Button>
              )}
            </div>

            {error && (
              <ErrorPanel error={error} title="Error fetching logs" />
            )}
          </InfoCard>
        </Grid>

        {selectedDataset && (
          <Grid item xs={12}>
            {schemaLoading && <Progress />}
            {schemaError && <ErrorPanel error={schemaError} />}
            {schema && (
              <InfoCard title={`Schema for ${selectedDataset}`}>
                <Table
                  options={{ paging: false, search: false }}
                  data={Object.entries(schema.schema).map(([field, type]) => ({
                    field,
                    type,
                  }))}
                  columns={[
                    { title: 'Field', field: 'field' },
                    { title: 'Type', field: 'type' },
                  ]}
                />
              </InfoCard>
            )}
          </Grid>
        )}
          
        <Grid item xs={12}>
          {logsLoading && <Progress />}
          {error && <ErrorPanel error={error} />}
          {!logsLoading && !error && logs.length === 0 && (
            <EmptyState
              missing="data"
              title="No logs found"
              description="No logs were found for the selected dataset and time range."
            />
          )}
          {!selectedDataset && (
            <Typography variant="body2" align="center">
              Select a dataset to view logs
            </Typography>
          )}
          {!logsLoading && !error && logs.length > 0 && (
            <InfoCard title={`Logs for ${selectedDataset}`} className={classes.logsContainer}>
              <Table
                options={{ paging: true, pageSize: 10, pageSizeOptions: [10, 20, 50] }}
                data={logs.map((log, index) => {
                  const level = log.level || log.severity || log.event_type || 'unknown';
                  // Get the color for the log level
                  const levelColor = getLogLevelColor(log);
                  
                  return {
                    id: index,
                    timestamp: log.p_timestamp || log.event_time || '',
                    level: level,
                    message: JSON.stringify(log, null, 2),
                    // Store the color as a string
                    levelColor: levelColor
                  };
                })}
                columns={[
                  { title: 'Timestamp', field: 'timestamp' },
                  { 
                    title: 'Level', 
                    field: 'level',
                    render: rowData => {
                      return (
                        <span style={{ color: rowData.levelColor, fontWeight: 'medium' }}>
                          {rowData.level}
                        </span>
                      );
                    }
                  },
                  { 
                    title: 'Message', 
                    field: 'message', 
                    render: rowData => (
                      <pre style={{ maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {rowData.message}
                      </pre>
                    )
                  },
                ]}
              />
            </InfoCard>
          )}
        </Grid>
      </Grid>
  </Content>
  );
};
