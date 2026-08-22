import { resolve, basename } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { parsePdf } from './intake_io';

export interface RemotePdfExtractionResult {
  url: string;
  cache_file_path: string;
  character_count: number;
  extracted_text: string;
  paragraphs: string[];
  key_evidence_quotes: string[];
}

export async function fetchAndParseRemotePdf(
  remoteUrl: string,
  options: { timeoutMs?: number; maxQuotes?: number } = {}
): Promise<RemotePdfExtractionResult | null> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxQuotes = options.maxQuotes ?? 5;

  if (!remoteUrl || !remoteUrl.toLowerCase().includes('.pdf')) {
    return null;
  }

  const repoRoot = process.cwd();
  const cacheDir = resolve(repoRoot, 'data/documents/remote_cache');
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const urlHash = crypto.createHash('sha256').update(remoteUrl).digest('hex').slice(0, 16);
  const cacheFilePath = resolve(cacheDir, `remote_${urlHash}.pdf`);

  // 1. Download if not cached
  if (!existsSync(cacheFilePath)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(remoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/pdf, */*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Basic PDF header verification
      if (!buffer.subarray(0, 5).toString().startsWith('%PDF')) {
        return null;
      }

      writeFileSync(cacheFilePath, buffer);
    } catch {
      return null;
    }
  }

  // 2. Multi-engine parse PDF
  try {
    const parsedText = parsePdf(cacheFilePath);
    if (!parsedText || parsedText.trim().length < 50) {
      return null;
    }

    const paragraphs = parsedText
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length >= 25);

    // Filter institutional high-value evidence quotes
    const evidenceKeywords = [
      '良率', '产能', '中标', '临床', '成本', '量产', '合同', '交付', '营收',
      '毛利', 'Wh/kg', '自由度', '万元', '亿元', '适航', '突破', '通过', '完成'
    ];

    const keyQuotes = paragraphs
      .filter((p: string) => evidenceKeywords.some((kw: string) => p.includes(kw)))
      .slice(0, maxQuotes);

    return {
      url: remoteUrl,
      cache_file_path: cacheFilePath,
      character_count: parsedText.length,
      extracted_text: parsedText,
      paragraphs,
      key_evidence_quotes: keyQuotes.length > 0 ? keyQuotes : paragraphs.slice(0, 2),
    };
  } catch {
    return null;
  }
}
