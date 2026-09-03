/// <reference lib="dom" />

export const send = () => new BroadcastChannel("leak").postMessage("board");
