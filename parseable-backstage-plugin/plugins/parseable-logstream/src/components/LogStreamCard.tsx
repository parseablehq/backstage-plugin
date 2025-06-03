import React, { useState, useEffect } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  InfoCard,
  Progress,
  ErrorPanel,
  EmptyState,
} from '@backstage/core-components';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
  IconButton,
  Typography,
  Tooltip,
  Paper,
} from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import PauseIcon from '@material-ui/icons/Pause';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { useAsync } from 'react-use';
import { parseableApiRef, ParseableClient, LogEntry } from '../api';

const useStyles = makeStyles(theme => ({
  logContainer: {
    height: '400px',
    overflowY: 'auto',
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1),
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    marginTop: theme.spacing(2),
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
  controls: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  formControl: {
    minWidth: 200,
    marginRight: theme.spacing(2),
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

type LogStreamCardProps = {
  title?: string;
};

export const LogStreamCard = ({ title = 'Parseable Logs' }: LogStreamCardProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const parseableClient = useApi(parseableApiRef) as ParseableClient;
  
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLiveTail, setIsLiveTail] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const baseUrl = entity.metadata.annotations?.['parseable.io/base-url'] || '';

  // Fetch available datasets
  const { value: userInfo, loading, error: userInfoError } = useAsync(async () => {
    if (!baseUrl) {
      throw new Error('No Parseable base URL found in entity annotations');
    }
    return await parseableClient.getUserInfo(baseUrl);
  }, [baseUrl]);

  // Fetch logs when dataset is selected or during live tail
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchLogs = async () => {
      if (!baseUrl || !selectedDataset) return;
      
      try {
        const logData = await parseableClient.getLogs(baseUrl, selectedDataset);
        setLogs(logData);
        setError(undefined);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLiveTail(false);
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
  }, [baseUrl, selectedDataset, isLiveTail, parseableClient]);

  const handleDatasetChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedDataset(event.target.value as string);
  };

  const toggleLiveTail = () => {
    setIsLiveTail(!isLiveTail);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Helper function to determine log level color
  const getLogLevelColor = (log: LogEntry): string | undefined => {
    const level = (log.level || log.severity || '').toString().toLowerCase();
    
    if (level.includes('error')) return classes.error;
    if (level.includes('warn')) return classes.warn;
    if (level.includes('info')) return classes.info;
    
    return undefined;
  };

  // Render log content with proper formatting
  const renderLogContent = (log: LogEntry) => {
    // Convert log entry to string representation
    const logString = JSON.stringify(log, null, 2);
    
    return (
      <div className={`${classes.logContent} ${getLogLevelColor(log)}`}>
        {logString}
      </div>
    );
  };

  if (loading) {
    return (
      <InfoCard title={title}>
        <Progress />
      </InfoCard>
    );
  }

  if (userInfoError || error) {
    return (
      <InfoCard title={title}>
        <ErrorPanel
          error={userInfoError || error || new Error('Unknown error')}
        >
          Check your Parseable credentials and base URL configuration.
        </ErrorPanel>
      </InfoCard>
    );
  }

  if (!userInfo || userInfo.datasets.length === 0) {
    return (
      <InfoCard title={title}>
        <EmptyState
          missing="data"
          title="No datasets available"
          description="No Parseable datasets found for your user. Make sure you have access to at least one dataset."
        />
      </InfoCard>
    );
  }

  return (
    <InfoCard title={title}>
      <div className={classes.controls}>
        <FormControl className={classes.formControl}>
          <InputLabel id="dataset-select-label">Dataset</InputLabel>
          <Select
            labelId="dataset-select-label"
            value={selectedDataset}
            onChange={handleDatasetChange}
          >
            {userInfo.datasets.map(dataset => (
              <MenuItem key={dataset} value={dataset}>
                {dataset}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Tooltip title={isLiveTail ? 'Pause live tail' : 'Start live tail'}>
          <IconButton onClick={toggleLiveTail} color={isLiveTail ? 'secondary' : 'default'}>
            {isLiveTail ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>
        
        {selectedDataset && (
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedDataset}
            onClick={async () => {
              try {
                const blob = await parseableClient.exportToCsv(baseUrl, selectedDataset);
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
        <ErrorPanel
          error={error}
          title="Error fetching logs"
        />
      )}

      {selectedDataset ? (
        <Paper variant="outlined" className={classes.logContainer}>
          {logs.length === 0 ? (
            <Typography variant="body2" align="center" style={{ padding: '16px' }}>
              No logs found for the selected dataset
            </Typography>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={classes.logLine}>
                {renderLogContent(log)}
                <IconButton
                  className={classes.copyButton}
                  size="small"
                  onClick={() => copyToClipboard(JSON.stringify(log))}
                >
                  <FileCopyIcon fontSize="small" />
                </IconButton>
              </div>
            ))
          )}
        </Paper>
      ) : (
        <Typography variant="body2" align="center">
          Select a dataset to view logs
        </Typography>
      )}
    </InfoCard>
  );
};
