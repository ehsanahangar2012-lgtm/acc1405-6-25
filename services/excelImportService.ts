import { Product, Person } from '../types';
import { generateId } from '../utils';

class ExcelImportService {
    async importProducts(file: File): Promise<Product[]> {
        const data = await this.readExcel(file);
        const products: Product[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue;

            products.push({
                id: generateId(),
                name: String(row[0] || ''),
                code: String(row[1] || ''),
                unit: String(row[2] || 'عدد'),
                price: Number(row[3]) || 0,
                stock: Number(row[4]) || 0,
                reservedStock: 0,
                minStock: Number(row[5]) || 0,
                category: String(row[6] || 'عمومی'),
                description: String(row[7] || '')
            });
        }

        return products;
    }

    async importPeople(file: File): Promise<Person[]> {
        const data = await this.readExcel(file);
        const people: Person[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue;

            people.push({
                id: generateId(),
                name: String(row[0] || ''),
                phone: String(row[1] || ''),
                address: String(row[2] || ''),
                nationalId: String(row[3] || ''),
                type: (row[4] === 'فروشنده' ? 'VENDOR' : 'CUSTOMER') as 'CUSTOMER' | 'VENDOR',
                balance: Number(row[5]) || 0,
                notes: String(row[6] || '')
            });
        }

        return people;
    }

    private async readExcel(file: File): Promise<any[][]> {
        const XLSX = (await import('xlsx')).default || await import('xlsx');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = (XLSX as any).read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = (XLSX as any).utils.sheet_to_json(firstSheet, { header: 1 });
                    resolve(jsonData as any[][]);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async downloadProductTemplate() {
        const XLSX = (await import('xlsx')).default || await import('xlsx');
        const data = [
            ['نام کالا*', 'کد کالا', 'واحد', 'قیمت*', 'موجودی', 'حداقل موجودی', 'دستهبندی', 'توضیحات'],
            ['لپتاپ ایسوس', 'LAP-001', 'عدد', '25000000', '10', '2', 'لپتاپ', 'مدل VivoBook'],
            ['ماوس لاجیتک', 'MOU-001', 'عدد', '350000', '50', '10', 'جانبی', 'بیسیم']
        ];
        const ws = (XLSX as any).utils.aoa_to_sheet(data);
        const wb = (XLSX as any).utils.book_new();
        (XLSX as any).utils.book_append_sheet(wb, ws, 'Sheet1');
        (XLSX as any).writeFile(wb, 'قالب_کالاها.xlsx');
    }

    async downloadPeopleTemplate() {
        const XLSX = (await import('xlsx')).default || await import('xlsx');
        const data = [
            ['نام*', 'تلفن', 'آدرس', 'کد ملی', 'نوع (مشتری/فروشنده)*', 'موجودی', 'یادداشت'],
            ['علی احمدی', '09121234567', 'تهران، خیابان ولیعصر', '1234567890', 'مشتری', '0', 'مشتری وفادار'],
            ['شرکت پخش سپهر', '02188776655', 'تهران، میدان آزادی', '1098765432', 'فروشنده', '-5000000', 'تامینکننده اصلی']
        ];
        const ws = (XLSX as any).utils.aoa_to_sheet(data);
        const wb = (XLSX as any).utils.book_new();
        (XLSX as any).utils.book_append_sheet(wb, ws, 'Sheet1');
        (XLSX as any).writeFile(wb, 'قالب_اشخاص.xlsx');
    }
}

export const excelImportService = new ExcelImportService();
