 /**
  * Logger Module Exports
  * Provides centralized logging with module-based filtering
  */
 
 export { Logger } from './Logger';
 export type { LogEntry, LogTransport } from './Logger';
 export { LogLevel, logLevelToString, stringToLogLevel } from './LogLevel';
 export { LogFormatter } from './LogFormatter';
 export { LoggerFactory } from './LoggerFactory';
 export { LoggerController } from './LoggerController';
 export type { LoggerControllerConfig, LoggerFilter } from './LoggerController';
 
 import { LoggerController } from './LoggerController';
 
 // Expose LoggerController globally for debugging from console
 if (typeof window !== 'undefined') {
   (window as any).LoggerController = LoggerController;
   (window as any).logger = {
     // Quick access methods
     enable: () => LoggerController.getInstance().setEnabled(true),
     disable: () => LoggerController.getInstance().setEnabled(false),
     
     // Filter shortcuts
     showOnly: (...contexts: string[]) => LoggerController.getInstance().showOnly(...contexts),
     hide: (...contexts: string[]) => LoggerController.getInstance().hide(...contexts),
     showAll: () => LoggerController.getInstance().showAll(),
     
     // Level shortcuts
     verbose: () => LoggerController.getInstance().verboseMode(),
     debug: () => LoggerController.getInstance().developmentMode(),
     quiet: () => LoggerController.getInstance().productionMode(),
     
     // Preset debug modes
     debugGameLoader: () => LoggerController.getInstance().debugGameLoader(),
     debugEventBus: () => LoggerController.getInstance().debugEventBus(),
     debugSpin: () => LoggerController.getInstance().debugSpin(),
     debugNetwork: () => LoggerController.getInstance().debugNetwork(),
     debugWins: () => LoggerController.getInstance().debugWins(),
     
     // History
     history: (filter?: { context?: string; limit?: number }) => 
       LoggerController.getInstance().getHistory(filter),
     clearHistory: () => LoggerController.getInstance().clearHistory(),
     
     // Info
     help: () => {
       console.log(`
 Logger Commands:
   logger.enable()           - Enable all logging
   logger.disable()          - Disable all logging
   
   logger.showOnly('ctx')    - Show only logs from specific context(s)
   logger.hide('ctx')        - Hide logs from specific context(s)
   logger.showAll()          - Show all logs (reset filters)
   
   logger.verbose()          - Show all log levels (TRACE+)
   logger.debug()            - Show INFO and above
   logger.quiet()            - Show only ERRORS
   
   logger.debugGameLoader()  - Debug game loading only
   logger.debugEventBus()    - Debug events only
   logger.debugSpin()        - Debug spin/controller only
   logger.debugNetwork()     - Debug network only
   logger.debugWins()        - Debug win evaluation only
   
   logger.history()          - Get log history
   logger.history({context: 'GameLoader', limit: 10})
   logger.clearHistory()     - Clear history
 `);
     },
   };
 }