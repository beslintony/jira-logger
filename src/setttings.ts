import * as fs from 'fs';
import * as path from 'path';
import { Settings } from './types';

const SETTINGS_PATH = path.join(__dirname, '../data/settings.json');

// Load settings from file
export const loadSettings = (): Settings => {
  // Make sure settings directory exists
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  if (!fs.existsSync(SETTINGS_PATH)) {
    // Create default settings if file doesn't exist
    initializeSettings();
  }
  
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading settings: ${error}. Using default settings.`);
    return getDefaultSettings();
  }
};

// Save settings to file
export const saveSettings = (settings: Settings): void => {
  // Make sure settings directory exists
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
};

// Get default settings
const getDefaultSettings = (): Settings => {
  return {
    jira: {
      baseUrl: '',
      username: '',
      apiToken: '',
      defaultProject: '',
    },
    timeRounding: {
      enabled: false,
      roundTo: 15,
    },
    fileStorage: {
      gsjbdPath: path.join(__dirname, '../data/time-tracking.gsjbd'),
      mappingsPath: path.join(__dirname, '../data/mappings.json'),
    },
    comments: {
      defaultTemplate: 'Worked on "{taskName}" for {timeSpent}',
    },
    appearance: {
      dateFormat: 'YYYY-MM-DD',
    },
    sync: {
      autoSyncMappings: true,
      reminderDays: 7,
    },
  };
};

// Initialize default settings
export const initializeSettings = (): void => {
  if (!fs.existsSync(SETTINGS_PATH)) {
    saveSettings(getDefaultSettings());
  }
};

// Check if settings are complete
export const validateSettings = (settings: Settings): boolean => {
  // Check required Jira settings
  if (!settings.jira.baseUrl || !settings.jira.username || !settings.jira.apiToken || !settings.jira.defaultProject) {
    return false;
  }
  
  // Check fileStorage paths
  if (!settings.fileStorage.gsjbdPath || !settings.fileStorage.mappingsPath) {
    return false;
  }
  
  return true;
};