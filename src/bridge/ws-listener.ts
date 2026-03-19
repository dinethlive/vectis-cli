import WebSocket from "ws";
import type { PenpotEvent } from "./types.js";
import type { Logger } from "../utils/logger.js";
import { WS_RECONNECT_INITIAL, WS_RECONNECT_MAX } from "../constants.js";

export type EventCallback = (event: PenpotEvent) => void;

export class WsListener {
  private ws: WebSocket | null = null;
  private url: string;
  private logger: Logger;
  private callbacks: EventCallback[] = [];
  private reconnectDelay = WS_RECONNECT_INITIAL;
  private shouldReconnect = true;
  private _connected = false;

  constructor(url: string, logger: Logger) {
    this.url = url;
    this.logger = logger;
  }

  get connected(): boolean {
    return this._connected;
  }

  onEvent(cb: EventCallback): void {
    this.callbacks.push(cb);
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        this._connected = true;
        this.reconnectDelay = WS_RECONNECT_INITIAL;
        this.logger.debug(`WS connected to ${this.url}`);
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as PenpotEvent;
          for (const cb of this.callbacks) {
            cb(event);
          }
        } catch (err) {
          this.logger.debug(`WS parse error: ${err}`);
        }
      });

      this.ws.on("close", () => {
        this._connected = false;
        this.logger.debug("WS disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err: Error) => {
        this._connected = false;
        this.logger.debug(`WS error: ${err.message}`);
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    setTimeout(() => {
      this.logger.debug(`WS reconnecting in ${this.reconnectDelay}ms...`);
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX);
    }, this.reconnectDelay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }
}
