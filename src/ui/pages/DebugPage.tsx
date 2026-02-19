/**
 * DebugPage - Development debug tools page
 */

import React, { useState, useEffect } from 'react';
import { EventBus } from '@/platform/events/EventBus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EventLogEntry {
  id: number;
  event: string;
  payload: unknown;
  timestamp: number;
}

export const DebugPage: React.FC = () => {
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!isListening) return;

    const eventBus = EventBus.getInstance();
    let logId = 0;

    const events = [
      'game:spin:request',
      'game:spin:start',
      'game:spin:stop',
      'game:spin:complete',
      'game:reels:stopped',
      'engine:ready',
      'engine:error',
    ];

    const handlers = events.map((event) => {
      const handler = (payload: unknown) => {
        setEventLog((prev) => [
          { id: logId++, event, payload, timestamp: Date.now() },
          ...prev.slice(0, 99),
        ]);
      };
      eventBus.on(event as any, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => {
        eventBus.off(event as any);
      });
    };
  }, [isListening]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Debug Console</h1>
          <Button
            onClick={() => setIsListening(!isListening)}
            variant={isListening ? 'destructive' : 'default'}
          >
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </Button>
        </div>

        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events">Event Log</TabsTrigger>
            <TabsTrigger value="state">Engine State</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Stream</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto space-y-1">
                  {eventLog.length === 0 ? (
                    <p className="text-muted-foreground">No events captured yet</p>
                  ) : (
                    eventLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="text-sm font-mono bg-muted p-2 rounded"
                      >
                        <span className="text-primary">{entry.event}</span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <pre className="text-xs mt-1 text-muted-foreground">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="state">
            <Card>
              <CardHeader>
                <CardTitle>Engine State</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Engine state inspection coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Performance metrics coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DebugPage;
