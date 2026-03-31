import { requireNativeModule, EventEmitter } from 'expo-modules-core';

type ServerEvents = {
  onFileReceived: (event: { path: string }) => void;
};

const ExpoBaishouServer = requireNativeModule('ExpoBaishouServer');
const emitter = new EventEmitter<ServerEvents>(ExpoBaishouServer);

export function startServer(port: number): number {
  return ExpoBaishouServer.startServer(port);
}

export function stopServer(): void {
  ExpoBaishouServer.stopServer();
}

export function onFileReceived(listener: (event: { path: string }) => void) {
  return emitter.addListener('onFileReceived', listener);
}
