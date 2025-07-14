import React, { useState, useEffect, useCallback } from 'react';
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
  Select,
  makeStyles,
  TextField,
  Grid,
  Typography,
  IconButton,
  Tooltip,
  MenuItem,
  DialogTitle,
  DialogContent,
  DialogActions,
  Dialog,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import SearchIcon from '@material-ui/icons/Search';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import GetAppIcon from '@material-ui/icons/GetApp';
import CheckIcon from '@material-ui/icons/Check';
import { useAsync } from 'react-use';
import { parseableApiRef } from '../api';
import type { LogEntry } from '../api/ParseableClient';

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
    marginBottom: theme.spacing(2),
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
  buttonGroup: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  actionButton: {
    borderRadius: 20,
    boxShadow: 'none',
    textTransform: 'none',
    fontWeight: 500,
    padding: theme.spacing(0.5, 2),
  },
  iconButton: {
    padding: theme.spacing(1),
  },
  searchFieldEnhanced: {
    marginBottom: theme.spacing(1),
    width: '100%',
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

  // Dialog state for showing full body content
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastContent, setToastContent] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  
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
  // Define fetchLogs as a callback that always uses the latest state values
  const fetchLogs = useCallback(async () => {
    if (!baseUrl || !selectedDataset) return;
    
    try {
      setLogsLoading(true);
      console.log('Fetching logs with query:', searchQuery, 'for dataset:', selectedDataset);
      
      // Use the updated getLogs method with time range parameters
      const logData = await parseableClient.getLogs(
        baseUrl, 
        selectedDataset, 
        100, 
        searchQuery,
        startDate || undefined,
        endDate || undefined
      );
      
      console.log('Fetched logs:', logData.length);
      setLogs(logData);
      setError(undefined);
      setLogsLoading(false);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLiveTail(false);
      setLogsLoading(false);
    }
  }, [baseUrl, selectedDataset, searchQuery, startDate, endDate, parseableClient]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Only set up live tail if enabled - no initial fetch when dataset changes
    if (isLiveTail && selectedDataset && baseUrl) {
      // Initial fetch for live tail
      fetchLogs();
      // Then set interval
      intervalId = setInterval(fetchLogs, 600000); // 10 minutes
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [baseUrl, selectedDataset, isLiveTail]);

  const handleDatasetChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newDataset = event.target.value as string;
    setSelectedDataset(newDataset);
    setLogs([]);
    setError(undefined);
    
    // Fetch logs with a default query when dataset is selected
    if (newDataset && baseUrl) {
      // Use a default time range (last 30 minutes)
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      // Format dates for display in the UI
      const formattedEndDate = now.toISOString();
      const formattedStartDate = thirtyMinutesAgo.toISOString();
      
      // Update the date pickers to reflect the default range
      setStartDate(formattedStartDate);
      setEndDate(formattedEndDate);
      
      // Temporarily set loading state
      setLogsLoading(true);
      
      console.log('Fetching default logs for dataset:', newDataset);
      console.log('Time range:', formattedStartDate, 'to', formattedEndDate);
      
      // Fetch logs with default parameters
      parseableClient.getLogs(
        baseUrl, 
        newDataset, 
        100, // Default limit
        '', // Empty query string
        formattedStartDate,
        formattedEndDate
      ).then(logData => {
        console.log('Fetched initial logs for dataset:', logData.length);
        setLogs(logData);
        setError(undefined);
        setLogsLoading(false);
      }).catch(err => {
        console.error('Error fetching initial logs:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLogsLoading(false);
      });
    }
  };

  const toggleLiveTail = () => {
    setIsLiveTail(!isLiveTail);
  };

  const handleSearch = () => {
    setIsLiveTail(false);
    // Explicitly fetch logs when search button is clicked
    fetchLogs();
  };
  
  // State for export functionality
  const [isExporting, setIsExporting] = useState(false);
  
  // Handle CSV export
  const handleExportCsv = async () => {
    if (!baseUrl || !selectedDataset) return;
    
    try {
      setIsExporting(true);
      
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
    } finally {
      setIsExporting(false);
    }
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
  
  // Format timestamp to be more readable
  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return '';
    
    try {
      // Try to parse the timestamp
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if parsing failed
      }
      
      // Format as a readable date and time
      return date.toLocaleString();
    } catch {
      return timestamp; // Return original on any error
    }
  };
  
  // Extract all unique fields from logs to create dynamic columns
  const extractLogFields = (logs: LogEntry[]): string[] => {
    const fieldsSet = new Set<string>();
    
    logs.forEach(log => {
      Object.keys(log).forEach(key => {
        // Skip timestamp fields as they'll be handled separately
        if (!['p_timestamp', 'event_time', 'timestamp', 'datetime'].includes(key)) {
          fieldsSet.add(key);
        }
      });
    });
    
    return Array.from(fieldsSet);
  };
  
  // Safely prepare log data for rendering to avoid 'in' operator errors
  const prepareLogsForRendering = (logs: LogEntry[]): Record<string, any>[] => {
    return logs.map(log => {
      // Create a new object with safe values for the table
      const preparedLog: Record<string, any> = {
        // Add a special property that Material Table needs for the 'in' operator
        original: {}
      };
      
      Object.entries(log).forEach(([key, value]) => {
        // Ensure all values are strings or primitives, not complex objects
        if (value === null || value === undefined) {
          preparedLog[key] = '';
        } else if (typeof value === 'object') {
          preparedLog[key] = JSON.stringify(value);
        } else {
          preparedLog[key] = String(value);
        }
        
        // Also store the original value in the 'original' property
        preparedLog.original[key] = value;
      });
      
      // Add levelColor separately since it's used for styling
      if (log.levelColor) {
        preparedLog.levelColor = log.levelColor;
        preparedLog.original.levelColor = log.levelColor;
      }
      
      return preparedLog;
    });
  };

  // Format body column content for better readability
  const formatBodyContent = (value: any): string => {
    if (!value) return '';
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  };
  
  // Helper function to render truncated text with 'See more' button
  const renderTruncatedText = (text: string) => {
    return (
      <div>
        <span style={{ display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text.substring(0, 50)}...
        </span>
        <Button 
          color="primary" 
          size="small" 
          style={{ marginLeft: '8px', textTransform: 'none' }}
          onClick={() => {
            setToastContent(text);
            setToastOpen(true);
          }}
        >
          See more
        </Button>
      </div>
    );
  };

  if (logsLoading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Content>
        <ContentHeader title="Parseable Dataset" />
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
        <ContentHeader title="Parseable Dataset" />
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
      <ContentHeader title="Parseable Dataset">
        <SupportButton>
          View your Parseable datasets with advanced search capabilities.
        </SupportButton>
      </ContentHeader>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <InfoCard title="Parseable Dataset">
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

            {/* <div className={classes.timeRangeControls}>
              <TextField
                label="Start Date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                disabled={isLiveTail}
                size="small"
              />
              
              <TextField
                label="End Date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                disabled={isLiveTail}
                size="small"
              />
            </div> */}
            
            <TextField
              className={classes.searchFieldEnhanced}
              label="Search Query (SQL syntax supported)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isLiveTail}
              placeholder="Simple text or SQL WHERE clause"
              helperText="Example: level='error' OR status>=400"
              fullWidth
              size="small"
              variant="outlined"
              margin="normal"
            />
            
            <div className={classes.buttonGroup}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                disabled={!selectedDataset || isLiveTail}
                className={classes.actionButton}
              >
                Show Logs
              </Button>
              
              <Tooltip title={isLiveTail ? 'Pause live tail' : 'Start live tail'}>
                <span> {/* Wrapper to handle disabled tooltip */}
                  <IconButton 
                    onClick={toggleLiveTail} 
                    color={isLiveTail ? 'secondary' : 'default'}
                    disabled={!selectedDataset}
                    size="small"
                    className={classes.iconButton}
                  >
                    {isLiveTail ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                </span>
              </Tooltip>
              
              {selectedDataset && (
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<GetAppIcon />}
                  onClick={handleExportCsv}
                  disabled={logs.length === 0 || isExporting}
                  className={classes.actionButton}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              )}
            </div>

            {error && (
              <ErrorPanel error={error} title="Error fetching logs" />
            )}
          </InfoCard>
        </Grid>

        {/* Schema table removed */}
          
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
                key={`logs-table-${selectedDataset}`}
                options={{
                  pageSize: 10,
                  pageSizeOptions: [10, 20, 50],
                  headerStyle: {
                    backgroundColor: '#e3f2fd',
                    color: '#000000',
                    fontWeight: 'bold',
                  },
                  maxBodyHeight: '600px',
                  minBodyHeight: '400px',
                  padding: 'default',
                  tableLayout: 'auto',
                  search: true,
                  paging: true,
                  sorting: true,
                  columnsButton: true
                }}
                data={prepareLogsForRendering(logs).map((log, index) => {
                  // Create a data object with all fields from the log
                  const rowData: Record<string, any> = { id: index };
                  
                  // Add timestamp field
                  rowData.timestamp = formatTimestamp(String(log.p_timestamp || log.datetime || log.event_time || ''));
                  
                  // Add all other fields from the log
                  Object.entries(log).forEach(([key, value]) => {
                    // Skip timestamp fields as they're already handled
                    if (!['p_timestamp', 'event_time', 'timestamp', 'datetime'].includes(key)) {
                      // Convert any object values to strings to avoid React errors
                      if (typeof value === 'object' && value !== null) {
                        // Special handling for body column
                        if (key === 'body') {
                          rowData[key] = formatBodyContent(value);
                        } else {
                          try {
                            const seen = new WeakSet();
                            rowData[key] = JSON.stringify(value, (_k, v) => {
                              if (typeof v === 'object' && v !== null) {
                                if (seen.has(v)) return '[Circular]';
                                seen.add(v);
                              }
                              return v;
                            });
                            
                            // Truncate long JSON strings
                            if (rowData[key].length > 200) {
                              rowData[key] = rowData[key].substring(0, 200) + '...';
                            }
                          } catch (error) {
                            rowData[key] = `[Error: ${error instanceof Error ? error.message : String(error)}]`;
                          }
                        }
                      } else {
                        rowData[key] = value === null ? '' : String(value);
                      }
                    }
                  });
                  
                  // Add level color for styling
                  rowData.levelColor = getLogLevelColor(log);
                  
                  return rowData;
                })}
                components={{
                  // Use a custom container to avoid the scrollWidth error
                  Container: props => <div {...props} style={{ overflowX: 'auto', width: '100%' }} />
                }}
                columns={(() => {
                  // Start with timestamp column
                  const columns: any[] = [
                    { 
                      title: 'Timestamp', 
                      field: 'timestamp',
                      render: (rowData: Record<string, any>) => <span>{String(rowData.timestamp || '')}</span>
                    }
                  ];
                  
                  // Add columns for all fields in the logs
                  if (logs.length > 0) {
                    const fields = extractLogFields(logs);
                    
                    // Add level/status/meta-state first if they exist
                    const priorityFields = ['level', 'meta-state', 'status', 'method', 'host', 'id'];
                    priorityFields.forEach(field => {
                      if (fields.includes(field)) {
                        columns.push({
                          title: field.charAt(0).toUpperCase() + field.slice(1).replace(/-/g, ' '),
                          field: field,
                          render: (rowData: Record<string, any>) => {
                            // Style level/status fields with colors
                            if (['level', 'meta-state', 'status'].includes(field)) {
                              return (
                                <span style={{
                                  color: field === 'status' && Number(rowData[field]) >= 400 ? '#d32f2f' : 
                                         field === 'level' || field === 'meta-state' ? rowData.levelColor : 'inherit',
                                  fontWeight: 'medium'
                                }}>
                                  {String(rowData[field] || '')}
                                </span>
                              );
                            }
                            return <span>{String(rowData[field] || '')}</span>;
                          }
                        });
                        // Remove from fields array to avoid duplication
                        fields.splice(fields.indexOf(field), 1);
                      }
                    });
                    
                    // Add remaining fields
                    fields.forEach(field => {
                      // Special handling for body column
                      if (field === 'body') {
                        columns.push({
                          title: 'Body',
                          field: 'body',
                          render: (rowData: Record<string, any>) => {
                            const bodyValue = rowData.body;
                            if (!bodyValue || typeof bodyValue !== 'string') {
                              return <span>{String(bodyValue || '')}</span>;
                            }
                            
                            // Try to parse as JSON if it looks like JSON
                            try {
                              if (bodyValue.startsWith('{') || bodyValue.startsWith('[')) {
                                const parsed = JSON.parse(bodyValue);
                                const displaySummary = typeof parsed === 'object' ? 
                                  Object.keys(parsed).slice(0, 3).map(k => k).join(', ') : 
                                  String(parsed).substring(0, 30);
                                  
                                return (
                                  <div>
                                    <span style={{ display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {displaySummary}
                                    </span>
                                    <Button 
                                      color="primary" 
                                      size="small" 
                                      style={{ marginLeft: '8px', textTransform: 'none' }}
                                      onClick={() => {
                                        setToastContent(JSON.stringify(parsed, null, 2));
                                        setToastOpen(true);
                                      }}
                                    >
                                      See more
                                    </Button>
                                  </div>
                                );
                              }
                              // If it's valid JSON but not an object/array that we handled above
                              // fall through to default handling below
                            } catch (e) {
                              console.debug('Failed to parse JSON body:', e);
                              // Parsing failed, fall through to default handling below
                            }
                            
                            // For non-JSON strings or parsing failures
                            return bodyValue.length > 50 ? renderTruncatedText(bodyValue) : <span>{bodyValue}</span>;
                          }
                        
                        });
                      } else {
                        columns.push({
                          title: field.charAt(0).toUpperCase() + field.slice(1).replace(/-/g, ' '),
                          field: field,
                          render: (rowData: Record<string, any>) => <span>{String(rowData[field] || '')}</span>
                        });
                      }
                    });
                  }
                  
                  return columns;
                })()}
              />
            </InfoCard>
          )}
        </Grid>
      </Grid>
      
      {/* Dialog for displaying full body content */}
      <Dialog
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          style: {
            maxHeight: '80vh',
            backgroundColor: '#282828', // Dark background to match Backstage theme
            color: '#fff',
          },
        }}
      >
        <DialogTitle style={{ borderBottom: '1px solid #444' }}>
          Log Body Content
          <IconButton
            aria-label="close"
            style={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}
            onClick={() => setToastOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers style={{ borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            fontSize: '13px',
            backgroundColor: '#333',
            color: '#eee',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '60vh',
            border: '1px solid #444'
          }}>
            {toastContent}
          </pre>
        </DialogContent>
        <DialogActions style={{ padding: '16px' }}>
          <Button onClick={() => setToastOpen(false)} style={{ color: '#9cc9ff' }}>
            Close
          </Button>
          <Button 
            onClick={() => {
              navigator.clipboard.writeText(toastContent);
              setCopyFeedback('Copied!');
              setTimeout(() => setCopyFeedback(''), 2000);
            }} 
            style={{ color: '#9cc9ff' }}
            startIcon={copyFeedback ? <CheckIcon style={{ color: '#4caf50' }} /> : undefined}
          >
            {copyFeedback || 'Copy to Clipboard'}
          </Button>
        </DialogActions>
      </Dialog>
    </Content>
  );
};
