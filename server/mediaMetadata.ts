import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';

const execFileAsync = util.promisify(execFile);

export interface ExtractedMetadata {
  durationSeconds?: number;
  resolution?: string;
  codec?: string;
  formatName?: string;
  bitrate?: number;
}

export async function extractMediaMetadata(filePath: string): Promise<ExtractedMetadata> {
  const result: ExtractedMetadata = {};

  if (!fs.existsSync(filePath)) {
    return result;
  }

  try {
    // Attempt ffprobe inspection
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { timeout: 15000 }
    );

    const data = JSON.parse(stdout);
    if (data.format) {
      if (data.format.duration) {
        result.durationSeconds = Math.round(parseFloat(data.format.duration));
      }
      if (data.format.bit_rate) {
        result.bitrate = parseInt(data.format.bit_rate, 10);
      }
      result.formatName = data.format.format_name;
    }

    if (data.streams && Array.isArray(data.streams)) {
      const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
      if (videoStream) {
        if (videoStream.width && videoStream.height) {
          result.resolution = `${videoStream.width}x${videoStream.height}`;
        }
        result.codec = videoStream.codec_name;
      } else {
        const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
        if (audioStream) {
          result.codec = audioStream.codec_name;
        }
      }
    }
  } catch {
    // If ffprobe is not applicable (e.g. document or synthetic media), return what we have
  }

  return result;
}
