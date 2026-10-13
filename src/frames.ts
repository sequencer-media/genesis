import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
export async function decodeGenesisEndFrame(input: string, frame: string) {
  const probe = await execute('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,duration,width,height:format=duration', '-of', 'json', input], { timeout: 60000, maxBuffer: 1024 * 1024 });
  const metadata = JSON.parse(probe.stdout), stream = metadata.streams?.[0], frames = Number(stream?.nb_read_frames), duration = Number(stream?.duration || metadata.format?.duration);
  if (!Number.isInteger(frames) || frames < 1 || frames > 1200 || !Number.isFinite(duration) || duration > 12 || stream.width * stream.height > 3840 * 2160) throw new Error('Checkpointing supports bounded clips up to 12 seconds and 4K.');
  // Select the exact last decoded frame without buffering the full video in memory.
  await execute('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file,pipe', '-i', input, '-an', '-vf', `select=eq(n\\,${frames - 1})`, '-frames:v', '1', '-q:v', '2', frame], { timeout: 60000, maxBuffer: 1024 * 1024 });
}
