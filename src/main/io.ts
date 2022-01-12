import { Mp4Atom } from "../worker/mp4-parser"

type Primitive =
  | bigint
  | boolean
  | null
  | number
  | string
  | undefined;

interface JSONArray extends Array<JSONValue> { }

type JSONValue = Primitive | JSONObject | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type ReadFn = (pos: number, length: number) => Promise<ArrayBuffer>;

export type MessageName = 
  "meta_info" |
  "moof_mdat" |
  "error"

/**
 * This is the interface calling from worker process to main process
 */
export interface IO {
  // do read async
  read: ReadFn,

  // called when new atom is parsed
  onNewAtom: (atom: Mp4Atom) => void,

  // called when FFmpeg emits a message
  onMessage: (name: MessageName, msg: JSONObject) => void,

  // called when FFmpeg pauses and goto sleep
  onFFmpegPaused: (pkt_pts: number, is_eof: number) => void,

  // called when FFmpeg seeks
  onSeek: () => void,
}