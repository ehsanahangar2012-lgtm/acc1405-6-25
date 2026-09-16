export class BackupService {
    private getBaseUrl(): string {
        if (typeof window === 'undefined') return '';
        
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        return isLocalhost ? '' : window.location.origin;
    }
    
    async backupData(type: string, data: any): Promise<boolean> {
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) return false;
        
        try {
            const response = await fetch(`${baseUrl}/backup-system.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'backup_data',
                    type,
                    payload: data
                })
            });
            const result = await response.json();
            return result.success;
        } catch (error) {
            return false;
        }
    }
    
    async uploadImage(file: File, folder: string): Promise<string | null> {
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) return null;
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('folder', folder);
            formData.append('action', 'upload_image');
            
            const response = await fetch(`${baseUrl}/backup-system.php`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            return result.success ? result.url : null;
        } catch (error) {
            return null;
        }
    }
    
    async getBackupList(type: string): Promise<any[]> {
        const baseUrl = this.getBaseUrl();
        if (!baseUrl) return [];
        
        try {
            const response = await fetch(`${baseUrl}/backup-system.php?action=get_backup_list&type=${type}`);
            return await response.json();
        } catch (error) {
            return [];
        }
    }
}

export const backupService = new BackupService();