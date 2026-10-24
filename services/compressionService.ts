class CompressionService {
    compress(data: any): string {
        try {
            return JSON.stringify(data);
        } catch {
            return '';
        }
    }

    decompress(data: string): any {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    getCompressionRatio(original: any, compressed: string): number {
        const originalSize = JSON.stringify(original).length;
        const compressedSize = compressed.length;
        return originalSize > 0 ? compressedSize / originalSize : 1;
    }
}

export const compressionService = new CompressionService();
