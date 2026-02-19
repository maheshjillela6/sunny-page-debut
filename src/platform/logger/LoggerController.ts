 /**
  * LoggerController - Centralized logger control with module-based filtering
  * Enables/disables logging globally and per-module
  */
 
 import { LogLevel, stringToLogLevel } from './LogLevel';
 import { LogEntry, LogTransport } from './Logger';
 import { LogFormatter } from './LogFormatter';
 
 export interface LoggerFilter {
   contexts: string[];
   enabled: boolean;
 }
 
 export interface LoggerControllerConfig {
   enabled: boolean;
   level: LogLevel;
   enabledContexts: string[];
   disabledContexts: string[];
   showTimestamp: boolean;
   showContext: boolean;
   useColors: boolean;
 }
 
 const DEFAULT_CONFIG: LoggerControllerConfig = {
   enabled: true,
   level: LogLevel.INFO,
   enabledContexts: [], // Empty = all enabled
   disabledContexts: [],
   showTimestamp: true,
   showContext: true,
   useColors: true,
 };
 
 export class LoggerController {
   private static instance: LoggerController | null = null;
   
   private config: LoggerControllerConfig;
   private transport: LogTransport | null = null;
   private history: LogEntry[] = [];
   private maxHistory: number = 500;
 
   private constructor() {
     this.config = { ...DEFAULT_CONFIG };
     this.setupDefaultTransport();
   }
 
   public static getInstance(): LoggerController {
     if (!LoggerController.instance) {
       LoggerController.instance = new LoggerController();
     }
     return LoggerController.instance;
   }
 
   private setupDefaultTransport(): void {
     this.transport = (entry: LogEntry): void => {
       // Check if globally enabled
       if (!this.config.enabled) return;
       
       // Check log level
       if (entry.level > this.config.level) return;
       
       // Check context filter
       if (!this.isContextEnabled(entry.context)) return;
 
       // Store in history
       this.history.push(entry);
       if (this.history.length > this.maxHistory) {
         this.history.shift();
       }
       
       // Format and output
       const formatted = this.formatEntry(entry);
       this.outputToConsole(entry.level, formatted, entry.data);
     };
   }
 
   private isContextEnabled(context?: string): boolean {
     if (!context) return true;
     
     const normalized = context.toLowerCase();
     
     // If enabledContexts is specified, only those are allowed
     if (this.config.enabledContexts.length > 0) {
       return this.config.enabledContexts.some(c => 
         normalized.includes(c.toLowerCase())
       );
     }
     
     // Otherwise, check if it's in disabled list
     if (this.config.disabledContexts.length > 0) {
       return !this.config.disabledContexts.some(c => 
         normalized.includes(c.toLowerCase())
       );
     }
     
     return true;
   }
 
   private formatEntry(entry: LogEntry): string {
     const parts: string[] = [];
     
     if (this.config.showTimestamp) {
       parts.push(new Date(entry.timestamp).toISOString().slice(11, 23));
     }
     
     parts.push(this.getLevelLabel(entry.level));
     
     if (this.config.showContext && entry.context) {
       parts.push(`[${entry.context}]`);
     }
     
     parts.push(entry.message);
     
     return parts.join(' ');
   }
 
   private getLevelLabel(level: LogLevel): string {
     const labels: Record<LogLevel, string> = {
       [LogLevel.ERROR]: 'ERROR',
       [LogLevel.WARN]: 'WARN ',
       [LogLevel.INFO]: 'INFO ',
       [LogLevel.DEBUG]: 'DEBUG',
       [LogLevel.TRACE]: 'TRACE',
     };
     return labels[level] ?? 'UNKN ';
   }
 
   private outputToConsole(level: LogLevel, message: string, data?: unknown): void {
     const args: unknown[] = [message];
     if (data !== undefined) {
       args.push(data);
     }
 
     switch (level) {
       case LogLevel.ERROR:
         console.error(...args);
         break;
       case LogLevel.WARN:
         console.warn(...args);
         break;
       case LogLevel.INFO:
         console.info(...args);
         break;
       case LogLevel.DEBUG:
         console.debug(...args);
         break;
       case LogLevel.TRACE:
         console.trace(...args);
         break;
     }
   }
 
   /**
    * Get the transport for use by Logger instances
    */
   public getTransport(): LogTransport {
     return this.transport!;
   }
 
   // ============ Configuration API ============
 
   /**
    * Enable/disable all logging
    */
   public setEnabled(enabled: boolean): void {
     this.config.enabled = enabled;
   }
 
   public isEnabled(): boolean {
     return this.config.enabled;
   }
 
   /**
    * Set global log level
    */
   public setLevel(level: LogLevel | string): void {
     if (typeof level === 'string') {
       this.config.level = stringToLogLevel(level);
     } else {
       this.config.level = level;
     }
   }
 
   public getLevel(): LogLevel {
     return this.config.level;
   }
 
   /**
    * Show only logs from specific contexts
    * Pass empty array to show all contexts
    */
   public showOnly(...contexts: string[]): void {
     this.config.enabledContexts = contexts;
     this.config.disabledContexts = [];
   }
 
   /**
    * Hide logs from specific contexts
    */
   public hide(...contexts: string[]): void {
     this.config.disabledContexts = contexts;
     this.config.enabledContexts = [];
   }
 
   /**
    * Reset context filters to show all
    */
   public showAll(): void {
     this.config.enabledContexts = [];
     this.config.disabledContexts = [];
   }
 
   /**
    * Get enabled context filters
    */
   public getEnabledContexts(): string[] {
     return [...this.config.enabledContexts];
   }
 
   /**
    * Get disabled context filters
    */
   public getDisabledContexts(): string[] {
     return [...this.config.disabledContexts];
   }
 
   /**
    * Configure display options
    */
   public setDisplayOptions(options: Partial<Pick<LoggerControllerConfig, 'showTimestamp' | 'showContext' | 'useColors'>>): void {
     Object.assign(this.config, options);
   }
 
   // ============ History API ============
 
   /**
    * Get log history, optionally filtered
    */
   public getHistory(filter?: { context?: string; level?: LogLevel; limit?: number }): LogEntry[] {
     let entries = [...this.history];
     
     if (filter?.context) {
       const ctx = filter.context.toLowerCase();
       entries = entries.filter(e => e.context?.toLowerCase().includes(ctx));
     }
     
     if (filter?.level !== undefined) {
       entries = entries.filter(e => e.level <= filter.level!);
     }
     
     if (filter?.limit) {
       entries = entries.slice(-filter.limit);
     }
     
     return entries;
   }
 
   /**
    * Clear history
    */
   public clearHistory(): void {
     this.history = [];
   }
 
   /**
    * Set max history size
    */
   public setMaxHistory(max: number): void {
     this.maxHistory = max;
     while (this.history.length > this.maxHistory) {
       this.history.shift();
     }
   }
 
   // ============ Preset Configurations ============
 
   /**
    * Show only game loader logs
    */
   public debugGameLoader(): void {
     this.showOnly('GameLoader', 'AssetPreloader', 'ConfigManager');
     this.setLevel(LogLevel.DEBUG);
   }
 
   /**
    * Show only event bus logs
    */
   public debugEventBus(): void {
     this.showOnly('EventBus', 'EventTracker');
     this.setLevel(LogLevel.DEBUG);
   }
 
   /**
    * Show only spin/game controller logs
    */
   public debugSpin(): void {
     this.showOnly('GameController', 'SpinLoop', 'GridManager', 'ReelController');
     this.setLevel(LogLevel.DEBUG);
   }
 
   /**
    * Show only network logs
    */
   public debugNetwork(): void {
     this.showOnly('NetworkManager', 'MockAdapter', 'RestAdapter', 'StompAdapter', 'ApiClient');
     this.setLevel(LogLevel.DEBUG);
   }
 
   /**
    * Show only win evaluation logs
    */
   public debugWins(): void {
     this.showOnly('WinEvaluator', 'LineEvaluator', 'WaysEvaluator', 'ClusterEvaluator', 'MegawaysEvaluator');
     this.setLevel(LogLevel.DEBUG);
   }
 
   /**
    * Production mode - errors only
    */
   public productionMode(): void {
     this.showAll();
     this.setLevel(LogLevel.ERROR);
   }
 
   /**
    * Development mode - all info+
    */
   public developmentMode(): void {
     this.showAll();
     this.setLevel(LogLevel.INFO);
   }
 
   /**
    * Verbose mode - everything
    */
   public verboseMode(): void {
     this.showAll();
     this.setLevel(LogLevel.TRACE);
   }
 
   /**
    * Reset to default configuration
    */
   public reset(): void {
     this.config = { ...DEFAULT_CONFIG };
   }
 
   public static resetInstance(): void {
     LoggerController.instance = null;
   }
 }
 
 export default LoggerController;