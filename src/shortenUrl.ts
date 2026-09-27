/**
 * zip1.io API を利用して URL を短縮するユーティリティ
 */

export interface ShortenUrlResponse {
    short_url?: string;
    error?: string;
}

/**
 * 指定された URL を zip1.io/api/create を使って短縮する。
 * エラーやタイムアウトが発生した場合は、フォールバックとして元の longUrl を返す。
 */
export async function shortenUrl(longUrl: string): Promise<string> {
    try {
        const response = await fetch('https://zip1.io/api/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: longUrl }),
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const data: ShortenUrlResponse = await response.json();
            if (data && typeof data.short_url === 'string' && data.short_url.trim()) {
                return data.short_url.trim();
            }
        }
    } catch (error) {
        console.warn('Failed to shorten URL using zip1.io, fallback to original URL:', error);
    }
    return longUrl;
}
