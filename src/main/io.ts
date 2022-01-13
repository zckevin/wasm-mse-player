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

/**
 * This is the interface calling from worker process to main process
 */
export interface IO {
  // do read async
  read: ReadFn

  // called when new atom is parsed
  onNewAtom: (atom: Mp4Atom) => void

  // called when FFmpeg emits a message
  onMessage: (name: FFmpegMsgName, msg: FFmpegMsg) => void

  // called when FFmpeg pauses and goto sleep
  onFFmpegPaused: (pkt_pts: number, is_eof: number) => void

  // called when FFmpeg seeks
  onSeek: () => void
}


export interface MetaInfoMsg {
  duration: number
  codec: string
}
export interface FragmentInfoMsg {
  from_seconds: number
  to_seconds: number
  moof_size: number
  mdata_size: number
}

export interface ErrorMsg {
  reason: string 
}

export type FFmpegMsgName = 
  "meta_info" |
  "fragment_info" |
  "error"

export type FFmpegMsg =
  MetaInfoMsg |
  FragmentInfoMsg |
  ErrorMsg 
