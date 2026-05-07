import { clearTimeout } from "timers";

export interface SSEProgressData {
  upload_id: string;
  stage: string;
  percentage: number;
  details: string;
  is_complete?: boolean;
  is_error?: boolean;
  can_cancel?: boolean;
  timestamp: string;
  metadata?: any;
}

export interface SSEConfig {
  uploadId: string;
  token?: string | null;
  onProgress: (data: SSEProgressData) => void;
  onComplete?: (data: SSEProgressData) => void;
  onError?: (error: Error, willRetry: boolean) => void;
  onConnected?: () => void;
  maxRetries?: number;
  retryDelay?: number;
}

export class SSEConnection {
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private maxRetries: number;
  private baseRetryDelay: number;
  private isConnected = false;
  private isManuallyClosed = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;
  private heartbeatCheckInterval: NodeJS.Timeout | null = null;

  // optimization reduced heartbeat frequency read
  private readonly HEARTBEAT_TIMEOUT_MS = 60000;
  private readonly HEARTBEAT_CHECK_INTERVAL_MS = 20000;

  constructor(private config: SSEConfig) {
    this.maxRetries = config.maxRetries || 5;
    this.baseRetryDelay = config.retryDelay || 1000;
  }

  connect(): void {
    if (this.isManuallyClosed) {
      console.warn("SSE connection was manually closed, not reconnecting");
      return;
    }

    this.disconnect(); // clean up any existing connection

    const apiURL = process.env.NEXT_PUBLIC_URL || "http://localhost:8000";
    let url = `${apiURL}/api/v1/progress/${this.config.uploadId}`;

    if (this.config.token) {
      url += `?token=${encodeURIComponent(this.config.token)}`;
    }

    console.log(`Connecting to SSE: ${url}`);

    try {
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        console.log("SSE connection established");
        this.isConnected = true;
        this.retryCount = 0;
        this.config.onConnected?.();
        this.startHeartbeatCheck();
      };

      this.eventSource.onmessage = (event) => {
        // handle heartbeat
        if (event.data.startsWith(":heartbeat")) {
          this.lastHeartbeat = Date.now();
          console.debug("❤️ SSE heartbeat received");
          return;
        }

        // handle keep-alive comment
        if (event.data.trim().startsWith(":")) {
          return;
        }

        try {
          const data = JSON.parse(event.data) as SSEProgressData;

          // validate data structure
          if (!data.stage || data.percentage === undefined) {
            console.warn("Incomplete SSE data received:", data);
            return;
          }

          // update heartbeat on any data
          this.lastHeartbeat = Date.now();

          console.log("SSE update:", {
            stage: data.stage,
            percentage: data.percentage,
            details: data.details?.substring(0, 50),
          });

          // ensure percentage bar is number
          const progressData: SSEProgressData = {
            ...data,
            percentage: Number(data.percentage) || 0,
            details: data.details || "",
            is_complete: data.is_complete || false,
            is_error: data.is_error || false,
            can_cancel: data.can_cancel ?? true,
          };

          // send progress update
          this.config.onProgress(data);

          // handle completion
          if (data.is_complete || data.is_error) {
            console.log(`🏁 SSE ${data.is_complete ? "completed" : "errored"}`);

            // set a delay before close to ensure a message is processed
            setTimeout(() => {
              this.disconnect();
              this.config.onComplete?.(data);
            }, 1000);
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error, event.data);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);

        // if there's an error, wait or it might be temporary
        if (this.isConnected) {
          this.isConnected = false;
          this.config.onError?.(new Error("Connection Lost"), true);
          this.scheduleReconnect();
        } else {
          // initial connection failed
          this.config.onError?.(
            new Error("Failed to connect"),
            this.retryCount < this.maxRetries,
          );
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("❌ Failed to create EventSource:", error);
      this.config.onError?.(error as Error, this.retryCount < this.maxRetries);
      this.scheduleReconnect();
    }
  }

  private startHeartbeatCheck(): void {
    this.lastHeartbeat = Date.now();

    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
    }

    // OPTIMIZED
    this.heartbeatCheckInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

      // OPTIMIZED
      if (
        this.isConnected &&
        timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT_MS
      ) {
        console.warn(
          `No heartbeat for ${this.HEARTBEAT_TIMEOUT_MS / 1000} seconds, reconnecting...`,
        );
        this.scheduleReconnect();
      }
    }, this.HEARTBEAT_CHECK_INTERVAL_MS);
  }

  private scheduleReconnect(): void {
    if (this.isManuallyClosed || this.retryCount >= this.maxRetries) {
      console.error(
        `Max retries (${this.maxRetries}) reached or manually closed`,
      );
      return;
    }

    this.retryCount++;
    const delay = this.baseRetryDelay * Math.pow(2, this.retryCount - 1);

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`,
    );

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    this.isConnected = false;

    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    console.log("SSE connection closed");
  }

  isConnecting(): boolean {
    return !this.isConnected && !this.isManuallyClosed;
  }

  getConnectionState(): "connected" | "connecting" | "disconnected" | "error" {
    if (this.isConnected) return "connected";
    if (this.isManuallyClosed) return "disconnected";
    if (this.retryCount > 0) return "error";
    return "connecting";
  }
}
