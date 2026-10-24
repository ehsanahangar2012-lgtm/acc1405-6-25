import { generateId } from '../utils';

interface ModulePermission {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

interface UserPermissions {
    dashboard: ModulePermission;
    invoices: ModulePermission;
    inventory: ModulePermission;
    checks: ModulePermission;
    finance: ModulePermission;
    customers: ModulePermission;
    reports: ModulePermission;
    settings: ModulePermission;
    users: ModulePermission;
}

const emptyPerm = (val: boolean = false): ModulePermission => ({ view: val, create: val, edit: val, delete: val });

const fullPermissions = (): UserPermissions => ({
    dashboard: emptyPerm(true),
    invoices: emptyPerm(true),
    inventory: emptyPerm(true),
    checks: emptyPerm(true),
    finance: emptyPerm(true),
    customers: emptyPerm(true),
    reports: emptyPerm(true),
    settings: emptyPerm(true),
    users: emptyPerm(true)
});

const defaultSystemConfig = {
    currency: 'RIAL',
    showDecimal: false,
    cloudEnabled: false,
    cloudProvider: 'HOST',
    syncInterval: 30,
    dateFormat: 'JALALI',
    defaultTaxRate: 9,
    defaultInvoiceFooter: "کالا صحیح و سالم تحویل گردید.",
    invoiceDueDays: 7,
    appTheme: 'DARK',
    uiScale: 100,
    smsPanelEnabled: false
};

// --- MIGRATION HELPERS FOR EACH ENTITY ---

const migrateCompany = (c: any): any => {
    if (!c || typeof c !== 'object') return c;
    const isActive = c.isActive !== undefined ? c.isActive : (c.is_active !== undefined ? c.is_active : true);
    const legalName = c.legalName || c.legal_name;
    const branches = Array.isArray(c.branches) ? c.branches : [];
    return {
        id: c.id || generateId(),
        name: c.name || '',
        address: c.address || '',
        phone: c.phone || '',
        isActive: Boolean(isActive),
        logo: c.logo || undefined,
        stamp: c.stamp || undefined,
        signature: c.signature || undefined,
        legalName: legalName || undefined,
        branches: branches,
        economicCode: c.economicCode || c.economic_code || '',
        nationalId: c.nationalId || c.national_id || '',
        registrationNumber: c.registrationNumber || c.registration_number || '',
        postalCode: c.postalCode || c.postal_code || '',
        email: c.email || '',
        website: c.website || '',
        updatedAt: c.updatedAt || c.updated_at || new Date().toISOString()
    };
};

const migrateProduct = (p: any): any => {
    if (!p || typeof p !== 'object') return p;
    
    const buyPrice = p.buyPrice !== undefined ? p.buyPrice : p.buy_price;
    const sellPrice = p.sellPrice !== undefined ? p.sellPrice : p.sell_price;
    const minStock = p.minStock !== undefined ? p.minStock : p.min_stock;
    const shelfLocation = p.shelfLocation !== undefined ? p.shelfLocation : p.shelf_location;
    const imageUrl = p.imageUrl !== undefined ? p.imageUrl : p.image_url;
    const reservedStock = p.reservedStock !== undefined ? p.reservedStock : p.reserved_stock;
    
    return {
        id: p.id || generateId(),
        name: p.name || '',
        code: p.code || '',
        buyPrice: buyPrice !== undefined ? Number(buyPrice) : undefined,
        sellPrice: sellPrice !== undefined ? Number(sellPrice) : undefined,
        price: p.price !== undefined ? Number(p.price) : undefined,
        stock: Number(p.stock || 0),
        reservedStock: Number(reservedStock || 0),
        minStock: minStock !== undefined ? Number(minStock) : undefined,
        unit: p.unit || 'عدد',
        weight: p.weight !== undefined ? Number(p.weight) : (p.wt !== undefined ? Number(p.wt) : undefined),
        shelfLocation: shelfLocation || undefined,
        category: p.category || undefined,
        description: p.description || undefined,
        imageUrl: imageUrl || undefined
    };
};

const migratePerson = (p: any): any => {
    if (!p || typeof p !== 'object') return p;
    
    const isCustomer = p.isCustomer !== undefined ? p.isCustomer : p.is_customer;
    const isSupplier = p.isSupplier !== undefined ? p.isSupplier : (p.is_supplier !== undefined ? p.is_supplier : p.isSupplier);
    const nationalId = p.nationalId !== undefined ? p.nationalId : p.national_id;
    
    let type = p.type;
    if (!type) {
        if (isCustomer) type = 'CUSTOMER';
        else if (isSupplier) type = 'VENDOR';
    }
    
    return {
        id: p.id || generateId(),
        code: p.code || undefined,
        name: p.name || '',
        phone: p.phone || undefined,
        email: p.email || undefined,
        balance: Number(p.balance || 0),
        category: p.category || undefined,
        type: type || undefined,
        isCustomer: isCustomer !== undefined ? Boolean(isCustomer) : undefined,
        isSupplier: isSupplier !== undefined ? Boolean(isSupplier) : undefined,
        address: p.address || undefined,
        nationalId: nationalId || undefined,
        notes: p.notes || undefined
    };
};

const migrateInvoiceItem = (item: any): any => {
    if (!item || typeof item !== 'object') return item;
    
    const productId = item.productId || item.product_id || generateId();
    const productName = item.productName || item.product_name || '';
    const buyPrice = item.buyPrice !== undefined ? item.buyPrice : item.buy_price;
    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
    
    return {
        productId,
        productName,
        quantity: Number(item.quantity || 0),
        buyPrice: Number(buyPrice || 0),
        unitPrice: Number(unitPrice || 0),
        total: Number(item.total || 0),
        profit: Number(item.profit || 0),
        description: item.description || undefined
    };
};

const migrateInvoice = (inv: any): any => {
    if (!inv || typeof inv !== 'object') return inv;
    
    const personId = inv.personId || inv.person_id || '';
    const personName = inv.personName || inv.person_name || '';
    const subTotal = inv.subTotal !== undefined ? inv.subTotal : inv.sub_total;
    const totalProfit = inv.totalProfit !== undefined ? inv.totalProfit : inv.total_profit;
    const finalTotal = inv.finalTotal !== undefined ? inv.finalTotal : inv.final_total;
    const cashAmount = inv.cashAmount !== undefined ? inv.cashAmount : inv.cash_amount;
    const checkAmount = inv.checkAmount !== undefined ? inv.checkAmount : inv.check_amount;
    const taxId = inv.taxId !== undefined ? inv.taxId : inv.tax_id;
    const driverName = inv.driverName || inv.driver_name;
    const driverPhone = inv.driverPhone || inv.driver_phone;
    const vehiclePlate = inv.vehiclePlate || inv.vehicle_plate;
    const workflowSignatures = inv.workflowSignatures || inv.workflow_signatures;
    
    const rawItems = Array.isArray(inv.items) ? inv.items : [];
    const items = rawItems.map(migrateInvoiceItem);
    
    return {
        id: inv.id || generateId(),
        companyId: inv.companyId || 'default',
        number: Number(inv.number || 0),
        trackingCode: inv.trackingCode || '',
        date: inv.date || '',
        dueDate: inv.dueDate || undefined,
        personId,
        personName,
        type: inv.type || 'فروش',
        items,
        subTotal: Number(subTotal || 0),
        totalProfit: Number(totalProfit || 0),
        tax: Number(inv.tax || 0),
        discount: Number(inv.discount || 0),
        finalTotal: Number(finalTotal || 0),
        cashAmount: Number(cashAmount || 0),
        checkAmount: Number(checkAmount || 0),
        checks: Array.isArray(inv.checks) ? inv.checks.map(migrateCheck) : undefined,
        description: inv.description || undefined,
        attachments: Array.isArray(inv.attachments) ? inv.attachments : undefined,
        signature: inv.signature || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        vehiclePlate: vehiclePlate || undefined,
        workflowSignatures: workflowSignatures || undefined,
        taxId: taxId || undefined
    };
};

const migrateVoucherItem = (item: any): any => {
    if (!item || typeof item !== 'object') return item;
    
    const productId = item.productId || item.product_id || generateId();
    const productName = item.productName || item.product_name || '';
    const shelfLocation = item.shelfLocation || item.shelf_location;
    const imageUrl = item.imageUrl || item.image_url;
    
    return {
        productId,
        productName,
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'عدد',
        weight: item.weight !== undefined ? Number(item.weight) : (item.wt !== undefined ? Number(item.wt) : undefined),
        shelfLocation: shelfLocation || undefined,
        description: item.description || undefined,
        imageUrl: imageUrl || undefined
    };
};

const migrateVoucher = (v: any): any => {
    if (!v || typeof v !== 'object') return v;
    
    const personId = v.personId || v.person_id || '';
    const personName = v.personName || v.person_name || '';
    const relatedInvoiceId = v.relatedInvoiceId || v.related_invoice_id;
    const relatedVoucherId = v.relatedVoucherId || v.related_voucher_id;
    const returnReason = v.returnReason || v.return_reason;
    const receiverPhone = v.receiverPhone || v.receiver_phone;
    const vehicleNumber = v.vehicleNumber || v.vehicle_number;
    const totalWeight = v.totalWeight !== undefined ? v.totalWeight : v.total_weight;
    const estimatedValue = v.estimatedValue !== undefined ? v.estimatedValue : v.estimated_value;
    const companySignature = v.companySignature || v.company_signature;
    const supervisorSignature = v.supervisorSignature || v.supervisor_signature;
    const loadingPhotos = v.loadingPhotos || v.loading_photos;
    const movementType = v.movementType || v.movement_type;
    const sourceWarehouseId = v.sourceWarehouseId || v.source_warehouse_id;
    const destinationWarehouseId = v.destinationWarehouseId || v.destination_warehouse_id;
    const warehouseId = v.warehouseId || v.warehouse_id;
    
    const rawItems = Array.isArray(v.items) ? v.items : [];
    const items = rawItems.map(migrateVoucherItem);
    
    return {
        id: v.id || generateId(),
        companyId: v.companyId || 'default',
        number: Number(v.number || 0),
        trackingCode: v.trackingCode || '',
        date: v.date || '',
        time: v.time || undefined,
        type: v.type || 'IN',
        personId,
        personName,
        relatedInvoiceId: relatedInvoiceId || undefined,
        relatedVoucherId: relatedVoucherId || undefined,
        returnReason: returnReason || undefined,
        supervisor: v.supervisor || undefined,
        vehicleNumber: vehicleNumber || undefined,
        receiverPhone: receiverPhone || undefined,
        items,
        totalWeight: totalWeight !== undefined ? Number(totalWeight) : undefined,
        estimatedValue: estimatedValue !== undefined ? Number(estimatedValue) : undefined,
        signature: v.signature || undefined,
        companySignature: companySignature || undefined,
        supervisorSignature: supervisorSignature || undefined,
        loadingPhotos: Array.isArray(loadingPhotos) ? loadingPhotos : undefined,
        notes: v.notes || undefined,
        status: v.status || undefined,
        deliveryTime: v.deliveryTime || undefined,
        qrCode: v.qrCode || undefined,
        movementType: movementType || undefined,
        sourceWarehouseId: sourceWarehouseId || undefined,
        destinationWarehouseId: destinationWarehouseId || undefined,
        warehouseId: warehouseId || undefined
    };
};

const migrateCheck = (c: any): any => {
    if (!c || typeof c !== 'object') return c;
    
    const bankName = c.bankName || c.bank_name || '';
    const dueDate = c.dueDate || c.due_date || '';
    const sayadId = c.sayadId || c.sayad_id || '';
    const checkNumber = c.checkNumber || c.check_number;
    const holderName = c.holderName || c.holder_name || '';
    const personId = c.personId || c.person_id;
    const personName = c.personName || c.person_name;
    const relatedInvoiceId = c.relatedInvoiceId || c.related_invoice_id;
    const imageUrl = c.imageUrl || c.image_url;
    const isHighPriority = c.isHighPriority !== undefined ? c.isHighPriority : c.is_high_priority;
    const checkType = c.checkType || c.check_type;
    
    return {
        id: c.id || generateId(),
        bankName,
        amount: Number(c.amount || 0),
        dueDate,
        status: c.status || 'PENDING',
        sayadId,
        checkNumber: checkNumber || undefined,
        holderName,
        personId: personId || undefined,
        personName: personName || undefined,
        relatedInvoiceId: relatedInvoiceId || undefined,
        imageUrl: imageUrl || undefined,
        history: Array.isArray(c.history) ? c.history : undefined,
        isHighPriority: isHighPriority !== undefined ? Boolean(isHighPriority) : undefined,
        description: c.description || undefined,
        checkType: checkType || undefined
    };
};

const migrateTransaction = (t: any): any => {
    if (!t || typeof t !== 'object') return t;
    
    const personId = t.personId || t.person_id || '';
    const personName = t.personName || t.person_name;
    const balanceAfter = t.balanceAfter !== undefined ? t.balanceAfter : t.balance_after;
    const isDebit = t.isDebit !== undefined ? t.isDebit : t.is_debit;
    const referenceId = t.referenceId || t.reference_id;
    const relatedInvoiceId = t.relatedInvoiceId || t.related_invoice_id;
    const trackingCode = t.trackingCode || t.tracking_code;
    
    return {
        id: t.id || generateId(),
        companyId: t.companyId || undefined,
        date: t.date || '',
        type: t.type || '',
        amount: Number(t.amount || 0),
        personId,
        personName: personName || undefined,
        description: t.description || '',
        balanceAfter: Number(balanceAfter || 0),
        isDebit: isDebit !== undefined ? Boolean(isDebit) : false,
        referenceId: referenceId || undefined,
        relatedInvoiceId: relatedInvoiceId || undefined,
        signature: t.signature || undefined,
        trackingCode: trackingCode || undefined,
        metadata: t.metadata || undefined
    };
};

const migrateCheckTransfer = (t: any): any => {
    if (!t || typeof t !== 'object') return t;
    
    const personId = t.personId || t.person_id || '';
    const personName = t.personName || t.person_name || '';
    const nationalId = t.nationalId || t.national_id;
    const trackingCode = t.trackingCode || t.tracking_code || '';
    const checkIds = Array.isArray(t.checkIds) ? t.checkIds : (Array.isArray(t.check_ids) ? t.check_ids : []);
    const receiverSignature = t.receiverSignature || t.receiver_signature;
    const receiverNationalId = t.receiverNationalId || t.receiver_national_id;
    
    return {
        id: t.id || generateId(),
        companyId: t.companyId || 'default',
        number: Number(t.number || 0),
        date: t.date || '',
        personId,
        personName,
        nationalId: nationalId || undefined,
        trackingCode,
        checkIds,
        signature: t.signature || undefined,
        receiverSignature: receiverSignature || undefined,
        receiverNationalId: receiverNationalId || undefined,
        items: Array.isArray(t.items) ? t.items : [],
        description: t.description || undefined,
        status: t.status || undefined
    };
};

const migrateSalary = (s: any): any => {
    if (!s || typeof s !== 'object') return s;
    
    const employeeId = s.employeeId || s.employee_id || '';
    const employeeName = s.employeeName || s.employee_name || '';
    const netAmount = s.netAmount !== undefined ? s.netAmount : s.net_amount;
    
    return {
        id: s.id || generateId(),
        employeeId,
        employeeName,
        date: s.date || '',
        amount: Number(s.amount || 0),
        bonus: Number(s.bonus || 0),
        deductions: Number(s.deductions || 0),
        netAmount: Number(netAmount || 0)
    };
};

const migrateContractItem = (item: any): any => {
    if (!item || typeof item !== 'object') return item;
    
    const isPaid = item.isPaid !== undefined ? item.isPaid : item.is_paid;
    const dueDate = item.dueDate || item.due_date;
    
    return {
        id: item.id || generateId(),
        description: item.description || '',
        amount: Number(item.amount || 0),
        dueDate: dueDate || undefined,
        isPaid: isPaid !== undefined ? Boolean(isPaid) : undefined
    };
};

const migrateContract = (c: any): any => {
    if (!c || typeof c !== 'object') return c;
    
    const personId = c.personId || c.person_id || '';
    const personName = c.personName || c.person_name || '';
    const startDate = c.startDate || c.start_date || '';
    const endDate = c.endDate || c.end_date;
    const totalAmount = c.totalAmount !== undefined ? c.totalAmount : c.total_amount;
    const companySignature = c.companySignature || c.company_signature;
    const trackingCode = c.trackingCode || c.tracking_code || '';
    const createdAt = c.createdAt || c.created_at || '';
    
    const rawItems = Array.isArray(c.items) ? c.items : [];
    const items = rawItems.map(migrateContractItem);
    
    return {
        id: c.id || generateId(),
        companyId: c.companyId || 'default',
        number: Number(c.number || 0),
        title: c.title || '',
        type: c.type || 'SERVICE',
        status: c.status || 'DRAFT',
        personId,
        personName,
        startDate,
        endDate: endDate || undefined,
        totalAmount: Number(totalAmount || 0),
        description: c.description || undefined,
        items,
        attachments: Array.isArray(c.attachments) ? c.attachments : undefined,
        signature: c.signature || undefined,
        companySignature: companySignature || undefined,
        trackingCode,
        createdAt,
        tags: Array.isArray(c.tags) ? c.tags : undefined
    };
};

const migrateAppUser = (u: any): any => {
    if (!u || typeof u !== 'object') return u;
    
    const fullName = u.fullName || u.full_name || '';
    const roleId = u.roleId || u.role_id || 'user';
    const hashedPassword = u.hashedPassword || u.hashed_password;
    const lastActive = u.lastActive || u.last_active;
    const isActive = u.is_active !== undefined ? u.is_active : (u.isActive !== undefined ? u.isActive : true);
    
    return {
        id: u.id || generateId(),
        username: u.username || '',
        fullName,
        roleId,
        hashedPassword,
        permissions: u.permissions || (roleId === 'admin' ? fullPermissions() : u.permissions),
        is_active: Boolean(isActive),
        lastActive: lastActive || undefined,
        email: u.email || '',
        recoveryKey: u.recoveryKey || u.recovery_key || '',
        securityQuestion: u.securityQuestion || u.security_question || '',
        securityAnswerHash: u.securityAnswerHash || u.security_answer_hash || '',
        updatedAt: u.updatedAt || u.updated_at || new Date().toISOString()
    };
};

export const backupMigrationService = {
    migrateBackupData(rawData: any): any {
        if (!rawData || typeof rawData !== 'object') {
            throw new Error('ساختار فایل پشتیبان نامعتبر است.');
        }

        let data = rawData;
        
        // Handle wrapping such as { success: true, data: ... }
        if (rawData.success && rawData.data) {
            data = rawData.data;
        }

        // Handle case where state is nested inside { state: ... } (e.g. zustand direct localstorage import)
        if (data.state) {
            const migratedState = this.migrateBackupData(data.state);
            return {
                ...data,
                state: migratedState
            };
        }

        const version = data.version || '1.0.0';
        console.log(`[BackupMigrationService] Processing mapping transformation for version ${version}...`);

        let transformedData = { ...data };

        // Normalize version representation
        const numVersion = parseFloat(version);
        const isLegacy = numVersion < 14.0 || isNaN(numVersion) || version.startsWith('1.') || version.startsWith('2.') || version.startsWith('3.');

        if (isLegacy) {
            console.log(`[BackupMigrationService] Legacy backup detected. Normalizing schemas to current standard.`);
            
            // 1. Map legacy "items" table to "products"
            if (Array.isArray(transformedData.items) && !transformedData.products) {
                transformedData.products = transformedData.items;
            }
            
            // 2. Map legacy "customers" / "suppliers" tables to "people"
            if (!transformedData.people) {
                transformedData.people = [];
            }
            if (Array.isArray(transformedData.customers)) {
                transformedData.people = [
                    ...transformedData.people,
                    ...transformedData.customers.map((c: any) => ({
                        ...c,
                        type: 'CUSTOMER',
                        isCustomer: true,
                        isSupplier: false
                    }))
                ];
            }
            if (Array.isArray(transformedData.suppliers)) {
                transformedData.people = [
                    ...transformedData.people,
                    ...transformedData.suppliers.map((s: any) => ({
                        ...s,
                        type: 'VENDOR',
                        isCustomer: false,
                        isSupplier: true
                    }))
                ];
            }

            // 3. Map legacy "sales_invoices" / "purchase_invoices" to "invoices"
            if (!transformedData.invoices) {
                transformedData.invoices = [];
            }
            if (Array.isArray(transformedData.sales_invoices)) {
                transformedData.invoices = [
                    ...transformedData.invoices,
                    ...transformedData.sales_invoices.map((inv: any) => ({
                        ...inv,
                        type: 'SALE'
                    }))
                ];
            }
            if (Array.isArray(transformedData.purchase_invoices)) {
                transformedData.invoices = [
                    ...transformedData.invoices,
                    ...transformedData.purchase_invoices.map((inv: any) => ({
                        ...inv,
                        type: 'PURCHASE'
                    }))
                ];
            }

            // 4. Map legacy "financial_vouchers" or "accounts_vouchers" to "vouchers"
            if (Array.isArray(transformedData.financial_vouchers) && !transformedData.vouchers) {
                transformedData.vouchers = transformedData.financial_vouchers;
            }
            if (Array.isArray(transformedData.accounts_vouchers) && !transformedData.vouchers) {
                transformedData.vouchers = transformedData.accounts_vouchers;
            }

            // 5. Normalizing properties of individual arrays to prevent "Invalid argument" or NaN errors during parsing
            if (Array.isArray(transformedData.products)) {
                transformedData.products = transformedData.products.map((p: any) => {
                    const buy_price = p.buy_price !== undefined ? p.buy_price : p.buyPrice;
                    const sell_price = p.sell_price !== undefined ? p.sell_price : p.sellPrice;
                    return {
                        ...p,
                        buyPrice: buy_price !== undefined ? Number(buy_price) : 0,
                        sellPrice: sell_price !== undefined ? Number(sell_price) : 0,
                        stock: p.stock !== undefined ? Number(p.stock) : 0
                    };
                });
            }

            if (Array.isArray(transformedData.invoices)) {
                transformedData.invoices = transformedData.invoices.map((inv: any) => {
                    const rawItems = Array.isArray(inv.items) ? inv.items : [];
                    const normalizedItems = rawItems.map((item: any) => {
                        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : (item.unit_price !== undefined ? item.unit_price : item.price);
                        const quantity = item.quantity !== undefined ? item.quantity : (item.qty !== undefined ? item.qty : 0);
                        return {
                            ...item,
                            productId: item.productId || item.product_id || generateId(),
                            productName: item.productName || item.product_name || item.name || 'کالای قدیمی',
                            quantity: Number(quantity),
                            unitPrice: Number(unitPrice || 0),
                            total: Number(item.total !== undefined ? item.total : (Number(quantity) * Number(unitPrice || 0)))
                        };
                    });
                    
                    const subtotal = inv.subtotal !== undefined ? inv.subtotal : (inv.subTotal !== undefined ? inv.subTotal : 0);
                    const total = inv.total !== undefined ? inv.total : 0;
                    
                    return {
                        ...inv,
                        items: normalizedItems,
                        subtotal: Number(subtotal),
                        total: Number(total),
                        type: inv.type || 'SALE'
                    };
                });
            }

            if (Array.isArray(transformedData.transactions)) {
                transformedData.transactions = transformedData.transactions.map((tx: any) => {
                    return {
                        ...tx,
                        amount: tx.amount !== undefined ? Number(tx.amount) : 0,
                        type: tx.type || 'DEPOSIT'
                    };
                });
            }

            if (Array.isArray(transformedData.checks)) {
                transformedData.checks = transformedData.checks.map((chk: any) => {
                    return {
                        ...chk,
                        amount: chk.amount !== undefined ? Number(chk.amount) : 0,
                        type: chk.type || 'RECEIVABLE'
                    };
                });
            }
        }

        data = transformedData;

        const migrated: any = {
            version: '14.0',
            timestamp: data.timestamp || new Date().toISOString(),
            companies: Array.isArray(data.companies) ? data.companies.map(migrateCompany) : [],
            products: Array.isArray(data.products) ? data.products.map(migrateProduct) : [],
            people: Array.isArray(data.people) ? data.people.map(migratePerson) : [],
            invoices: Array.isArray(data.invoices) ? data.invoices.map(migrateInvoice) : [],
            vouchers: Array.isArray(data.vouchers) ? data.vouchers.map(migrateVoucher) : [],
            checks: Array.isArray(data.checks) ? data.checks.map(migrateCheck) : [],
            transactions: Array.isArray(data.transactions) ? data.transactions.map(migrateTransaction) : [],
            checkTransfers: Array.isArray(data.checkTransfers) ? data.checkTransfers.map(migrateCheckTransfer) : [],
            salaries: Array.isArray(data.salaries) ? data.salaries.map(migrateSalary) : [],
            contracts: Array.isArray(data.contracts) ? data.contracts.map(migrateContract) : [],
            users: Array.isArray(data.users) ? data.users.map(migrateAppUser) : [],
            importConfigs: Array.isArray(data.importConfigs) ? data.importConfigs : [],
            importBatches: Array.isArray(data.importBatches) ? data.importBatches : [],
            logisticsProfiles: Array.isArray(data.logisticsProfiles) ? data.logisticsProfiles : [],
            config: {
                ...defaultSystemConfig,
                ...(data.config || {})
            },
            signature: data.signature || ''
        };

        // If some other state keys are present, keep them to avoid losing other properties
        Object.keys(data).forEach(key => {
            if (migrated[key] === undefined) {
                migrated[key] = data[key];
            }
        });

        return migrated;
    }
};
