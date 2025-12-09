// Frontend Configuration Service
// This service fetches runtime configuration from the backend

import { useState, useEffect } from 'react';
import { getBackendUrl } from './BioEmuService';

class ConfigService {
  constructor() {
    this.config = null;
    this.isLoaded = false;
  }

  async loadConfig() {
    if (this.isLoaded) {
      return this.config;
    }

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/config`);
      if (response.ok) {
        this.config = await response.json();
        this.isLoaded = true;
        console.log('🔧 Runtime configuration loaded:', this.config);
        return this.config;
      } else {
        throw new Error(`Failed to load config: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to load runtime config, using defaults:', error);

      // Fallback configuration
      this.config = {
        backendUrl: process.env.REACT_APP_BACKEND_URL || "",
        apiEndpoint: "not_configured",
        apiKeyConfigured: false,
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0"
      };
      this.isLoaded = true;
      return this.config;
    }
  }

  getBackendUrl() {
    return this.config?.backendUrl || process.env.REACT_APP_BACKEND_URL || "";
  }

  isApiConfigured() {
    return this.config?.apiKeyConfigured || false;
  }

  getEnvironment() {
    return this.config?.environment || "development";
  }

  getVersion() {
    return this.config?.version || "1.0.0";
  }
}

// Export singleton instance
export const configService = new ConfigService();

// React hook for easy usage
export const useConfig = () => {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configService.loadConfig().then(loadedConfig => {
      setConfig(loadedConfig);
      setIsLoading(false);
    });
  }, []);

  return { config, isLoading };
};

export default configService;
