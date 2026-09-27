import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shortenUrl } from './shortenUrl';

describe('shortenUrl', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should return short_url on successful API call', async () => {
        const mockLongUrl = 'https://example.com/?playlist=longstringdata';
        const mockShortUrl = 'https://zip1.io/abc123';

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ short_url: mockShortUrl }),
        } as Response);

        const result = await shortenUrl(mockLongUrl);
        expect(result).toBe(mockShortUrl);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://zip1.io/api/create',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: mockLongUrl }),
            })
        );
    });

    it('should fallback to longUrl on HTTP error response', async () => {
        const mockLongUrl = 'https://example.com/?playlist=longstringdata';

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        } as Response);

        const result = await shortenUrl(mockLongUrl);
        expect(result).toBe(mockLongUrl);
    });

    it('should fallback to longUrl on fetch rejection / exception', async () => {
        const mockLongUrl = 'https://example.com/?playlist=longstringdata';

        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

        const result = await shortenUrl(mockLongUrl);
        expect(result).toBe(mockLongUrl);
    });
});
